#!/usr/bin/env python3
"""Parser de wikitext de WikiDex para las plantillas {{Pokédex}} y {{Localización}}.

Opera sobre el wikitext crudo ya volcado en scripts/wikidex_dump/wikidex.sqlite (ver
dump_wikidex.py) — no hace ninguna petición de red, es una transformación offline sobre
datos que David ya descargó. Ver .claude/memory/project_pokewebmax_wikidex_dump_analysis.md
para el análisis de estructura y el plan de integración completo (este archivo cubre el
paso 1: el parser).
"""

import argparse
import re
import sqlite3
from html import unescape
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).parent / "wikidex_dump" / "wikidex.sqlite"

# Valores de campo que WikiDex usa para marcar "esta especie/forma no aparece en este
# juego" — hay que tratarlos como ausentes, no como texto real.
ABSENT_VALUES = {"no hay"}

# --- Extracción de bloques de plantilla -------------------------------------------------


def find_template_block(wikitext, template_name):
    """Texto interior (sin llaves ni nombre) del primer {{template_name ... }} de nivel
    superior, contando profundidad de llaves para no cortar en la primera '}}' que
    aparezca (las plantillas anidadas como {{NombreHaEs|...}} tienen la suya propia).
    Devuelve None si la plantilla no aparece o el dump la dejó sin cerrar (truncado).

    `template_name` se trata como nombre completo, no como prefijo: '{{Pokédex EP}}'
    (plantilla distinta usada en páginas de episodios de anime, con campos ES/HA/Pokémon
    propios) NO cuenta como match de 'Pokédex' — se comprueba que tras el nombre, salvo
    espacios en blanco, venga '|' o '}}' (arranque de parámetros o plantilla vacía)."""
    marker = "{{" + template_name
    search_from = 0
    while True:
        start = wikitext.find(marker, search_from)
        if start == -1:
            return None

        j = start + len(marker)
        n = len(wikitext)
        while j < n and wikitext[j] in " \t\n":
            j += 1
        if j >= n or wikitext[j] not in "|}":
            search_from = start + len(marker)
            continue

        depth = 0
        i = start
        while i < n - 1:
            two = wikitext[i : i + 2]
            if two == "{{":
                depth += 1
                i += 2
                continue
            if two == "}}":
                depth -= 1
                i += 2
                if depth == 0:
                    return wikitext[start + len(marker) : i - 2]
                continue
            i += 1
        return None


FIELD_LINE_RE = re.compile(r"^\|\s*([^=\n]+?)\s*=\s*(.*)$")


def _brace_bracket_delta(line):
    """Variación neta de profundidad de {{ }} / [[ ]] en una línea (cuenta ambos igual,
    solo hace falta saber si al final de la línea seguimos dentro de una plantilla o
    enlace sin cerrar)."""
    delta = 0
    i = 0
    n = len(line)
    while i < n - 1:
        two = line[i : i + 2]
        if two in ("{{", "[["):
            delta += 1
            i += 2
            continue
        if two in ("}}", "]]"):
            delta -= 1
            i += 2
            continue
        i += 1
    return delta


def parse_fields(block_text, continuation_sep=" "):
    """Interior de una plantilla clave=valor (una entrada por línea, con continuación en
    líneas siguientes que no empiezan por '|', ver caso 'stadium 2' de Bulbasaur) a un
    dict clave -> valor crudo (todavía con markup de wikitexto sin limpiar).
    `continuation_sep` controla cómo se unen las líneas de continuación: ' ' colapsa a
    una sola línea (flavor text), '\\n' conserva la estructura (listas de Localización).

    Solo se considera separador de campo un '|' de inicio de línea si además estamos a
    profundidad 0 de llaves/corchetes — si no, es una sub-línea de una plantilla anidada
    multilínea (visto en Localización: {{Imagen pop-up|...|border = Sí\\n}}, cuyo propio
    'border = ...' interno no debe leerse como campo nuevo del bloque exterior)."""
    fields = {}
    current_key = None
    depth = 0
    for line in block_text.split("\n"):
        m = FIELD_LINE_RE.match(line) if depth == 0 else None
        if m:
            current_key = m.group(1).strip()
            fields[current_key] = m.group(2).rstrip()
        elif current_key is not None and line.strip():
            fields[current_key] += continuation_sep + line.strip()
        depth = max(0, depth + _brace_bracket_delta(line))
    return fields


def split_top_level(text, sep="|"):
    """Divide `text` por `sep`, ignorando las apariciones dentro de [[...]] o {{...}} —
    necesario porque un valor puede ser {{NombreHaEs|... [[Enlace|texto]] ...|...}} y el
    '|' del enlace interno no debe contarse como separador de parámetro (visto en
    'Farfetch’d' y 'Snorunt', ver tests)."""
    parts = []
    depth_brace = 0
    depth_bracket = 0
    buf = []
    i = 0
    n = len(text)
    while i < n:
        two = text[i : i + 2]
        if two == "{{":
            depth_brace += 1
            buf.append(two)
            i += 2
            continue
        if two == "}}":
            depth_brace -= 1
            buf.append(two)
            i += 2
            continue
        if two == "[[":
            depth_bracket += 1
            buf.append(two)
            i += 2
            continue
        if two == "]]":
            depth_bracket -= 1
            buf.append(two)
            i += 2
            continue
        ch = text[i]
        if ch == sep and depth_brace == 0 and depth_bracket == 0:
            parts.append("".join(buf))
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    parts.append("".join(buf))
    return parts


# --- Resolución de alias y variantes regionales ------------------------------------------

# Primera letra insensible a mayúsculas (convención de MediaWiki para nombres de
# plantilla) — verificado en el dump: aparecen 'NombreHaEs', 'nombreHaEs', 'N' y 'n'.
VARIANT_TEMPLATE_RE = re.compile(r"^\{\{(?:[Nn]ombreHaEs|[Nn])\|(.*)\}\}$", re.DOTALL)


def resolve_variant_template(value, variant="es"):
    """Si el valor completo es {{NombreHaEs|hispanoamerica|espana}} (o su alias
    {{N|...}}), devuelve la variante pedida: 'es' = España, 'ha' = Hispanoamérica.
    Orden de parámetros confirmado con 'Metagross' (rubí): 1º = 'una computadora
    analógica' (LatAm), 2º = 'un ordenador analógico' (España) — coincide con el orden
    del nombre de la plantilla (Ha antes que Es). Si no es una plantilla de variante,
    devuelve el valor sin tocar."""
    m = VARIANT_TEMPLATE_RE.match(value.strip())
    if not m:
        return value
    params = split_top_level(m.group(1), "|")
    if len(params) != 2:
        return value
    hispanoamerica, espana = params
    return espana if variant == "es" else hispanoamerica


_VARIANT_TEMPLATE_NAME_RE = re.compile(r"^[Nn]ombreHaEs$|^[Nn]$")


def resolve_inline_variants(text, variant="es"):
    """Como resolve_variant_template, pero para plantillas de variante EMBEBIDAS dentro
    de una prosa más larga en vez de ser el valor completo — caso de las páginas de
    habilidad/movimiento ('Efecto': 'Reduce el ataque con {{N|Tacleada|Placaje}}...'),
    a diferencia de {{Pokédex}} donde el valor entero de cada clave ES la plantilla.
    Todas las apariciones se resuelven, no solo la primera."""
    result = []
    i = 0
    n = len(text)
    while i < n:
        if text[i : i + 2] == "{{":
            name_match = re.match(r"\{\{([A-Za-z]+)\|", text[i:])
            if name_match and _VARIANT_TEMPLATE_NAME_RE.match(name_match.group(1)):
                depth = 0
                j = i
                while j < n - 1:
                    two = text[j : j + 2]
                    if two == "{{":
                        depth += 1
                        j += 2
                        continue
                    if two == "}}":
                        depth -= 1
                        j += 2
                        if depth == 0:
                            break
                        continue
                    j += 1
                inner_start = i + 2 + len(name_match.group(1)) + 1
                params = split_top_level(text[inner_start : j - 2], "|")
                if len(params) == 2:
                    result.append(params[1] if variant == "es" else params[0])
                else:
                    result.append(text[i:j])
                i = j
                continue
        result.append(text[i])
        i += 1
    return "".join(result)


def resolve_alias(key, fields, seen=None):
    """Valor de `key`, resolviendo alias (el valor es literalmente el nombre de otra
    clave del mismo bloque, p.ej. 'zafiro = rubí') de forma recursiva. Protegido contra
    ciclos con `seen`."""
    if seen is None:
        seen = set()
    value = fields.get(key)
    if value is None:
        return None
    stripped = value.strip()
    if stripped in fields and stripped != key and stripped not in seen:
        seen.add(key)
        return resolve_alias(stripped, fields, seen)
    return value


# --- Limpieza de wikitexto a texto plano --------------------------------------------------

_REF_RE = re.compile(r"<ref[^>]*>.*?</ref>", re.DOTALL | re.IGNORECASE)
_REF_SELFCLOSE_RE = re.compile(r"<ref[^>]*/>", re.IGNORECASE)
_HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
_BR_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)
_BOLD_RE = re.compile(r"'''(.*?)'''")
_ITALIC_RE = re.compile(r"''(.*?)''")
_PIPED_LINK_RE = re.compile(r"\[\[[^\]|]*\|([^\]]*)\]\]")
_PLAIN_LINK_RE = re.compile(r"\[\[([^\]]*)\]\]")
_WHITESPACE_RE = re.compile(r"[ \t]+")
# Insignias decorativas sin texto propio usadas en Localización (p.ej. {{NC}} = "no
# canónico", {{LMT}} = zona con límite de tiempo, {{IA}} = info adicional...) — no hay
# forma de traducirlas a texto plano sin una tabla de plantillas de WikiDex, así que se
# descartan. Iterativo por si quedan anidadas dentro de otra plantilla ya vaciada.
_GENERIC_TEMPLATE_RE = re.compile(r"\{\{[^{}]*\}\}")


def _strip_remaining_templates(text):
    previous = None
    while previous != text:
        previous = text
        text = _GENERIC_TEMPLATE_RE.sub(" ", text)
    return text


def clean_wikitext(text, collapse_newlines=True):
    """Wikitexto crudo -> texto plano: descarta <ref>, [[enlace|visible]] -> visible,
    [[enlace]] -> enlace, '''negrita'''/''cursiva'' -> texto plano, <br> -> separador,
    entidades HTML sin escapar. `collapse_newlines=False` conserva saltos de línea
    (listas de Localización); con True (por defecto, flavor text) los convierte en
    espacio, igual que hace el frontend con el texto de PokeAPI
    (frontend/src/utils/pokemonFicha.js:56)."""
    text = _HTML_COMMENT_RE.sub("", text)
    text = _REF_RE.sub("", text)
    text = _REF_SELFCLOSE_RE.sub("", text)
    text = _BR_RE.sub("\n" if not collapse_newlines else " ", text)
    text = _PIPED_LINK_RE.sub(r"\1", text)
    text = _PLAIN_LINK_RE.sub(r"\1", text)
    text = _BOLD_RE.sub(r"\1", text)
    text = _ITALIC_RE.sub(r"\1", text)
    # Restos de '''/'' sin cerrar (typos reales en el wikitext fuente, p.ej. Localización
    # de Minun x/y: "* Salvaje: '''Ruta 5." sin cierre) — ya no hay nada que resaltar,
    # se descartan los delimitadores sueltos.
    text = text.replace("'''", "").replace("''", "")
    text = _strip_remaining_templates(text)
    text = unescape(text)
    if collapse_newlines:
        text = text.replace("\n", " ").replace("\f", " ")
        text = _WHITESPACE_RE.sub(" ", text).strip()
    else:
        text = "\n".join(_WHITESPACE_RE.sub(" ", line).strip() for line in text.split("\n"))
        text = text.strip()
    return text


# --- Entradas de alto nivel ---------------------------------------------------------------

# Metadato, no una versión de juego — presente en casi todos los bloques {{Pokédex}}.
_NON_VERSION_KEYS = {"generación"}


def parse_pokedex_descriptions(wikitext, variant="es"):
    """Bloque {{Pokédex}} de una ficha de especie -> dict clave-WikiDex -> texto limpio.
    Las claves siguen el vocabulario en español de WikiDex (rojoyazul, oro, lgpe, go...),
    el mapeo a `version` slug de PokeAPI es el paso 2, todavía sin escribir (ver memoria).
    Excluye 'generación' y las entradas 'no hay'."""
    block = find_template_block(wikitext, "Pokédex")
    if block is None:
        return {}
    fields = parse_fields(block)
    result = {}
    for key in fields:
        if key in _NON_VERSION_KEYS:
            continue
        raw = resolve_alias(key, fields)
        if raw is None:
            continue
        resolved = resolve_variant_template(raw, variant=variant)
        if resolved.strip().lower() in ABSENT_VALUES:
            continue
        cleaned = clean_wikitext(resolved)
        if cleaned:
            result[key] = cleaned
    return result


# --- Paso 2: mapeo clave-WikiDex -> version slug de PokeAPI -----------------------------

# Confirmado contra los 53 `version` ya cacheados en este mismo proyecto (docker exec
# pokewebmax_db mariadb -uroot -proot pokewebmax -e "SELECT resource_id, name FROM
# pokeapi_resource_cache WHERE resource_type='version'"), no de memoria — evita typos de
# slug que romperían el cruce en silencio. Una clave WikiDex puede cubrir más de un slug
# de PokeAPI (rojoyazul y lgpe son 1:2, ver análisis en memoria).
WIKIDEX_KEY_TO_POKEAPI_VERSIONS = {
    "rojoyazul": ("red", "blue"),
    "amarillo": ("yellow",),
    "oro": ("gold",),
    "plata": ("silver",),
    "cristal": ("crystal",),
    "rubí": ("ruby",),
    "zafiro": ("sapphire",),
    "esmeralda": ("emerald",),
    "rojofuego": ("firered",),
    "verdehoja": ("leafgreen",),
    "diamante": ("diamond",),
    "perla": ("pearl",),
    "platino": ("platinum",),
    "oro heartgold": ("heartgold",),
    "plata soulsilver": ("soulsilver",),
    "negro": ("black",),
    "blanco": ("white",),
    "negro 2": ("black-2",),
    "blanco 2": ("white-2",),
    "x": ("x",),
    "y": ("y",),
    "rubí omega": ("omega-ruby",),
    "zafiro alfa": ("alpha-sapphire",),
    "sol": ("sun",),
    "luna": ("moon",),
    "ultrasol": ("ultra-sun",),
    "ultraluna": ("ultra-moon",),
    "lgpe": ("lets-go-pikachu", "lets-go-eevee"),
    "espada": ("sword",),
    "escudo": ("shield",),
    "diamante brillante": ("brilliant-diamond",),
    "perla reluciente": ("shining-pearl",),
    "leyendas Arceus": ("legends-arceus",),
    "escarlata": ("scarlet",),
    "púrpura": ("violet",),
    "leyendas ZA": ("legends-za",),
}

# Claves de WikiDex con descripciones de spin-offs sin `version` equivalente en PokeAPI
# (Pokémon GO, Ranger, Pinball RZ, Stadium 1/2, Masters, Sleep, Pokopia, New Snap).
# Documentadas aquí para dejar constancia de que su ausencia del mapeo de arriba es
# intencional (no van al selector de juego, ver nota de arquitectura en memoria) — no
# afecta a pokedex_by_pokeapi_version(), que simplemente las ignora al no tener slug.
WIKIDEX_NON_VERSION_KEYS = frozenset(
    {
        "go",
        "ranger",
        "ranger2",
        "ranger3",
        "pinballrz",
        "stadium",
        "stadium 2",
        "masters",
        "sleep",
        "pokopia",
        "new snap",
    }
)


def pokedex_by_pokeapi_version(wikitext, variant="es"):
    """Igual que parse_pokedex_descriptions(), pero re-indexado por `version` slug de
    PokeAPI en vez de por clave WikiDex — listo para cruzar con
    `species.flavor_text_entries[].version.name` (frontend/src/utils/pokemonFicha.js:51).
    Las claves de WikiDex sin slug de PokeAPI (spin-offs) se descartan."""
    by_wikidex_key = parse_pokedex_descriptions(wikitext, variant=variant)
    result = {}
    for key, text in by_wikidex_key.items():
        for slug in WIKIDEX_KEY_TO_POKEAPI_VERSIONS.get(key, ()):
            result[slug] = text
    return result


def parse_localizacion(wikitext, variant="es"):
    """Bloque {{Localización}} de una ficha de especie -> dict clave-WikiDex -> texto
    limpio (conserva saltos de línea, cada ficha suele tener varias entradas tipo lista
    por juego). Mismo mecanismo de alias/variante que parse_pokedex_descriptions."""
    block = find_template_block(wikitext, "Localización")
    if block is None:
        return {}
    fields = parse_fields(block, continuation_sep="\n")
    result = {}
    for key in fields:
        if key in _NON_VERSION_KEYS:
            continue
        raw = resolve_alias(key, fields)
        if raw is None:
            continue
        resolved = resolve_variant_template(raw, variant=variant)
        if resolved.strip().lower() in ABSENT_VALUES:
            continue
        cleaned = clean_wikitext(resolved, collapse_newlines=False)
        if cleaned:
            result[key] = cleaned
    return result


# --- Habilidades y movimientos: bloque == Efecto == ---------------------------------------
#
# Formato de página TOTALMENTE distinto al de especies: no es una plantilla clave=valor,
# es una sección de wikitexto normal con encabezados. Dos formas vistas:
#   1. Prosa simple (habilidades sin cambios entre generaciones, ej. 'Espesura'):
#      == Efecto ==
#      Espesura aumenta la potencia de los movimientos...
#   2. Desglose por generación (habilidades/movimientos que cambiaron con el tiempo,
#      ej. 'Intimidación', 'Tacleada/Placaje'):
#      == Efecto ==
#      === En combate ===
#      ;Tercera generación
#      :Intimidación reduce en un nivel...
#      ;Desde cuarta a sexta generación
#      :La habilidad Intimidación ahora también...
# En el caso 2 se usa la ÚLTIMA entrada ':texto' (la más reciente, incluso aunque esté
# redactada como delta de la anterior — mismo criterio de "quedarse con la versión
# actual" que moveLevelLearned/pokedex_by_pokeapi_version en el resto del proyecto).

_SECOND_LEVEL_HEADING_RE = re.compile(r"\n==[^=]")
# {3,} (no exactamente 3) para que también corte en subsecciones de nivel 4 como
# "==== Glitches ====" — antes solo se detectaba nivel 3 exacto y ese tipo de bloque se
# colaba entero en el texto (visto en 'Cadena de mordiscos', 'Tambor'...).
_THIRD_LEVEL_HEADING_RE = re.compile(r"\n={3,}[^=]")
_DEFLIST_TEXT_RE = re.compile(r"^:(.+)$", re.MULTILINE)


def _heading_section(wikitext, heading, boundary_re):
    """Texto entre '== heading ==' (o '=== heading ===' si `heading` ya trae los
    signos) y el siguiente encabezado del mismo nivel o superior."""
    start = wikitext.find(heading)
    if start == -1:
        return None
    start += len(heading)
    m = boundary_re.search(wikitext, start)
    end = m.start() if m else len(wikitext)
    return wikitext[start:end]


def parse_effect(wikitext, variant="es"):
    """Bloque == Efecto == de una página de habilidad o movimiento -> texto plano
    representativo, o None si la página no tiene esa sección (no es una página de
    habilidad/movimiento, o el título no coincidía con nada real — ver
    effect_title_candidates)."""
    section = _heading_section(wikitext, "== Efecto ==", _SECOND_LEVEL_HEADING_RE)
    if section is None:
        return None

    combat = _heading_section(section, "=== En combate ===", _THIRD_LEVEL_HEADING_RE)
    if combat is not None:
        body = combat
    else:
        # Sin desglose "En combate": cortar en la primera subsección que sea (ej.
        # "=== En otros videojuegos ===", "=== Movimiento Z ===") en vez de tragarse
        # toda la sección "Efecto" — solo interesa el párrafo introductorio.
        m = _THIRD_LEVEL_HEADING_RE.search(section)
        body = section[: m.start()] if m else section

    entries = _DEFLIST_TEXT_RE.findall(body)
    raw = entries[-1] if entries else body

    raw = resolve_inline_variants(raw, variant=variant)
    cleaned = clean_wikitext(raw)
    return cleaned or None


# --- Descripciones propias de variantes Mega/Gigamax ---------------------------------
#
# A diferencia del resto del parser (indexado por `version` de juego), esto es
# indexado por FORMA — la ficha de especie de WikiDex (ej. "Charizard") incluye, en
# secciones aparte de la Pokédex por juego, una prosa descriptiva propia de cada
# Megaevolución/Gigamax (aspecto, cómo cambia al transformarse...) que PokeAPI no
# tiene en absoluto para variantes (comparte la descripción de la especie base para
# todas sus variantes, ver .claude/memory/project_pokewebmax_progress.md). Pedido por
# David 2026-08-24: para estas formas, priorizar este texto sobre el de PokeAPI.
#
# Estructura real en wikitext (confirmada con Charizard/Absol/Mewtwo/Venusaur/Gengar/
# Raichu/Eevee/Blastoise/Pikachu, cobertura 121/121 variantes mega/gmax ya cacheadas
# en este proyecto verificada por script antes de escribir esto en el código):
# - Encabezado "=== Mega-<Especie> ===" (nivel 3, o nivel 4 en páginas con más
#   subsecciones previas, ej. Pikachu) seguido de:
#   - Un único Pokémon puede megaevolucionar: prosa directa, sin viñetas (ej. Venusaur,
#     Gengar, Absol en su forma base).
#   - Varias formas (X/Y, o X/Y + una Z de "Megadimensión", el DLC de Leyendas Z-A ya
#     tratado en PokemonFichaAssembler): viñetas `* '''Mega-<Especie> <Letra>''' (...)
#     prosa`, una por forma.
# - Encabezado "=== <Especie> Gigamax ===" (mismo patrón de nivel), siempre prosa
#   directa sin viñetas (una única forma Gigamax por especie).
# - Cada bloque termina en la siguiente cabecera de su mismo nivel o superior, o en la
#   tabla `{| class="evolucion"` que seguro pasa a continuación — lo que venga antes.
#
# **Trampa real encontrada y evitada**: la sección "== Características de combate =="
# (mucho más abajo en la página) repite encabezados "=== Mega-<Especie> <Letra> ==="
# para las tablas de stats (ej. "=== Mega-Raichu X ===" con una plantilla
# {{Características|...}} debajo, sin ninguna prosa) — coincide con el mismo patrón de
# encabezado pero no lleva descripción real. Se descarta con un umbral de longitud
# (`_MIN_VARIETY_TEXT_LENGTH`): verificado que las entradas basura de esa sección
# limpian a 40-44 caracteres ("Las características de Mega-Raichu X son:") mientras
# que la entrada real más corta de las 125 encontradas en el dump son 299 caracteres —
# margen amplio, no es un umbral ajustado a ojo.
_VARIETY_ANNOTATION_RE = re.compile(r"\(\s*'''''.*?en inglés.*?en japonés.*?\)", re.DOTALL)
_VARIETY_HEADING_RE = re.compile(r"\n(={2,6})\s*([^=\n]+?)\s*\1\n")
_VARIETY_MEGA_HEADING_RE = re.compile(r"^Mega-.+$")
_VARIETY_GMAX_HEADING_RE = re.compile(r".*\bGigamax$")
_VARIETY_BULLET_RE = re.compile(r"^\*\s*'''(Mega-[^']+?)'''", re.MULTILINE)
_VARIETY_BULLET_LETTER_RE = re.compile(r"^Mega-.+?\s+([XYZ])$")
_MIN_VARIETY_TEXT_LENGTH = 150


def _variety_section_body(wikitext, start, level):
    """Texto desde `start` hasta el próximo encabezado de nivel <= `level` o la tabla
    `{| ...`, lo que aparezca antes — ninguno de los dos es opcional en la práctica
    (todo bloque de mega/gmax visto en el dump va seguido de la tabla de evolución)."""
    heading_match = re.search(r"\n={2," + str(level) + r"}[^=]", wikitext[start:])
    table_match = re.search(r"\n\{\|", wikitext[start:])
    ends = [m.start() for m in (heading_match, table_match) if m]
    end = start + min(ends) if ends else len(wikitext)
    return wikitext[start:end]


def parse_variety_descriptions(wikitext):
    """Wikitext de una página de especie -> dict `forma -> texto` para sus
    Megaevoluciones/Gigamax. Claves posibles: `mega` (una única mega sin letra),
    `mega-x`/`mega-y`/`mega-z`, `gmax`. El caller (wikidex_export_variety_descriptions.py)
    no sabe nada de wikitext, solo recibe este dict ya limpio."""
    result = {}
    for heading_match in _VARIETY_HEADING_RE.finditer(wikitext):
        level = len(heading_match.group(1))
        heading = heading_match.group(2).strip()
        is_mega = bool(_VARIETY_MEGA_HEADING_RE.match(heading))
        is_gmax = bool(_VARIETY_GMAX_HEADING_RE.match(heading))
        if not is_mega and not is_gmax:
            continue

        body = _variety_section_body(wikitext, heading_match.end(), level)
        body = _VARIETY_ANNOTATION_RE.sub("", body)
        bullets = list(_VARIETY_BULLET_RE.finditer(body))

        if is_gmax:
            _set_variety_text(result, "gmax", clean_wikitext(body))
            continue
        if not bullets:
            _set_variety_text(result, "mega", clean_wikitext(body))
            continue
        for i, bullet_match in enumerate(bullets):
            letter_match = _VARIETY_BULLET_LETTER_RE.match(bullet_match.group(1).strip())
            key = f"mega-{letter_match.group(1).lower()}" if letter_match else "mega"
            segment_start = bullet_match.end()
            segment_end = bullets[i + 1].start() if i + 1 < len(bullets) else len(body)
            _set_variety_text(result, key, clean_wikitext(body[segment_start:segment_end]))

    return result


def _set_variety_text(result, key, text):
    # No pisar una entrada ya válida (ver nota de la sección "Características de
    # combate" arriba) ni aceptar texto demasiado corto para ser una descripción real.
    if key not in result and len(text) >= _MIN_VARIETY_TEXT_LENGTH:
        result[key] = text


def effect_title_candidates(es_name, es419_name):
    """Títulos de página posibles para una habilidad/movimiento dado su nombre en
    España y en Hispanoamérica (`names[es]`/`names[es-419]` de PokeAPI). Cuando
    difieren, WikiDex titula la página como 'Hispanoamérica/España' (ej.
    'Tacleada/Placaje' para Tackle: es-419='Tacleada', es='Placaje') — verificado con
    varios casos reales, mismo orden Ha-antes-que-Es que {{NombreHaEs}}. Cuando
    coinciden (la mayoría), es solo el nombre. Devuelve una lista para probar en
    orden, no un único título."""
    candidates = []
    if es_name:
        candidates.append(es_name)
    if es419_name and es419_name != es_name:
        candidates.append(es419_name)
        candidates.append(f"{es419_name}/{es_name}")
        candidates.append(f"{es_name}/{es419_name}")
    return candidates


# --- CLI de prueba manual ------------------------------------------------------------------


def _main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("title", help="Título exacto de la página en WikiDex, p.ej. Bulbasaur")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Ruta a wikidex.sqlite")
    parser.add_argument("--variant", choices=["es", "ha"], default="es")
    parser.add_argument("--localizacion", action="store_true", help="Parsear Localización en vez de Pokédex")
    parser.add_argument(
        "--by-version",
        action="store_true",
        help="Indexar por version slug de PokeAPI en vez de por clave WikiDex (solo aplica a Pokédex)",
    )
    args = parser.parse_args()

    con = sqlite3.connect(args.db)
    row = con.execute("SELECT wikitext FROM pages WHERE title = ?", (args.title,)).fetchone()
    if row is None:
        raise SystemExit(f"No se encontró la página '{args.title}' en {args.db}")

    if args.by_version:
        fn = pokedex_by_pokeapi_version
    elif args.localizacion:
        fn = parse_localizacion
    else:
        fn = parse_pokedex_descriptions
    entries = fn(row[0], variant=args.variant)
    if not entries:
        print("(sin entradas)")
        return
    for key, text in entries.items():
        print(f"[{key}]")
        print(text)
        print()


if __name__ == "__main__":
    _main()
