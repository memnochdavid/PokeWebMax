#!/usr/bin/env python3
"""Cruza los ~2223 `item` de PokeAPI (ya cacheados en la BD) con los iconos locales
descargados de WikiDex (frontend/public/objects/, nombrados a partir de
scripts/links.txt) para poder pedir el icono de un objeto por su slug de PokeAPI
(inglés, ej. "fire-stone") en vez de por el título en español de WikiDex.

Solo empareja por igualdad exacta tras normalizar (sin tildes, minúsculas) — nada de
heurísticas difusas. Los objetos sin match se listan al final para revisión manual
(mismo criterio que NAME_OVERRIDES en animatedSprite.js: solo se añaden a mano los
casos evidentes).

Requiere que `item` esté cacheado en la base de datos (ya lo está: 2223/2223, ver
`/cache`). Vuelca el dump vía `docker exec` a la base de datos del proyecto.

Salida: frontend/src/utils/itemIconMap.generated.json
"""

import json
import re
import subprocess
import unicodedata
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
MANIFEST_FILE = SCRIPT_DIR / "item_images_manifest.json"
OBJECTS_DIR = SCRIPT_DIR.parent / "frontend" / "public" / "objects"
OUTPUT_FILE = (
    SCRIPT_DIR.parent / "frontend" / "src" / "utils" / "itemIconMap.generated.json"
)

DB_CONTAINER = "pokewebmax_db"
DB_USER = "pokewebmax"
DB_PASS = "pokewebmax"
DB_NAME = "pokewebmax"


def normalize(text):
    normalized = unicodedata.normalize("NFKD", text)
    ascii_only = "".join(c for c in normalized if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", ascii_only.lower()).strip()


QUALIFIER_RE = re.compile(r"\s*\(([^()]+)\)\s*$")


def name_variants(full_name):
    """Todas las variantes de nombre de un título de WikiDex (antes y después de
    la barra), para no perder emparejamientos como 'Ultrabola/Ultra Ball'."""
    return [part.strip() for part in full_name.split("/") if part.strip()]


def strip_qualifier(name):
    """Quita un calificador final entre paréntesis, ej. 'Antídoto (objeto)' ->
    'Antídoto'. Devuelve (nombre_sin_calificador, calificador_o_None)."""
    match = QUALIFIER_RE.search(name)
    if not match:
        return name, None
    return name[: match.start()].strip(), match.group(1).strip().lower()


def load_wikidex_titles():
    """normalized_name -> filename real en disco.

    El nombre de fichero sale del manifiesto que escribe download_item_images.py
    (título -> fichero final, YA con el sufijo de desambiguación de colisiones
    aplicado si lo tuvo) en vez de recalcular el slug aquí — recalcularlo se
    equivocaba en los ~5 casos de colisión (ej. 'Pokébola/Poké Ball (objeto)' se
    guardó como 'pokebola_objeto.png', no 'pokebola.png', porque coincidía con la
    variante Hisui).

    WikiDex además desambigua algunos títulos con un calificador final entre
    paréntesis (ej. 'Antídoto (objeto)') porque esa palabra también significa otra
    cosa en la wiki — PokeAPI nunca trae ese calificador en su nombre, así que se
    registra también la versión sin él. Se procesan primero los títulos con
    calificador '(objeto)' para que ganen sobre otras variantes regionales tipo
    '(Hisui)' al desambiguar el nombre base.
    """
    with MANIFEST_FILE.open(encoding="utf-8") as f:
        manifest = json.load(f)  # título completo -> fichero

    rows = sorted(manifest.keys(), key=lambda title: 0 if title.rstrip().endswith("(objeto)") else 1)

    by_normalized = {}
    for title in rows:
        filename = manifest[title]
        for variant in name_variants(title):
            by_normalized.setdefault(normalize(variant), filename)
            stripped, _qualifier = strip_qualifier(variant)
            if stripped != variant:
                by_normalized.setdefault(normalize(stripped), filename)
    return by_normalized


# Casos sueltos donde el nombre `es` de PokeAPI está abreviado ("Caramelo Exp. L") y
# no coincide, ni tras normalizar, con el título completo de WikiDex ("Caramelo
# Experiencia L") — comprobados a mano contra ficheros reales del pack.
MANUAL_OVERRIDES = {
    "exp-candy-xs": "caramelo_experiencia_xs.png",
    "exp-candy-s": "caramelo_experiencia_s.png",
    "exp-candy-m": "caramelo_experiencia_m.png",
    "exp-candy-l": "caramelo_experiencia_l.png",
    "exp-candy-xl": "caramelo_experiencia_xl.png",
}


def existing_objects():
    return {p.name for p in OBJECTS_DIR.glob("*.png")}


# Los objetos "MT" (Máquina Técnica) no tienen icono propio por objeto en WikiDex — su
# icono real depende del TIPO del movimiento que enseñan (pedido explícito de David).
# David descargó a mano los 18 iconos de tipo estilo novena generación (Escarlata/
# Púrpura, "EP" en el nombre de fichero) que WikiDex también usa para las MTs.
TM_TYPE_ICON = {
    "normal": "MT_tipo_normal_EP.png",
    "fighting": "MT_tipo_lucha_EP.png",
    "flying": "MT_tipo_volador_EP.png",
    "poison": "MT_tipo_veneno_EP.png",
    "ground": "MT_tipo_tierra_EP.png",
    "rock": "MT_tipo_roca_EP.png",
    "bug": "MT_tipo_bicho_EP.png",
    "ghost": "MT_tipo_fantasma_EP.png",
    "steel": "MT_tipo_acero_EP.png",
    "fire": "MT_tipo_fuego_EP.png",
    "water": "MT_tipo_agua_EP.png",
    "grass": "MT_tipo_planta_EP.png",
    "electric": "MT_tipo_eléctrico_EP.png",
    "psychic": "MT_tipo_psíquico_EP.png",
    "ice": "MT_tipo_hielo_EP.png",
    "dragon": "MT_tipo_dragón_EP.png",
    "dark": "MT_tipo_siniestro_EP.png",
    "fairy": "MT_tipo_hada_EP.png",
}

# Las 21 mentas de naturaleza tampoco tienen icono propio en WikiDex — la página
# "Menta" (tabla resumen) confirma que el icono real solo distingue por la
# CARACTERÍSTICA que sube (color), no por naturaleza individual: 4 mentas comparten
# cada color salvo la neutra. Iconos "EP" (Escarlata/Púrpura) descargados de esa misma
# página para que hagan juego con los de MT.
NATURE_MINT_ICON = {
    "lonely-mint": "menta_roja.png",
    "adamant-mint": "menta_roja.png",
    "naughty-mint": "menta_roja.png",
    "brave-mint": "menta_roja.png",
    "bold-mint": "menta_azul.png",
    "impish-mint": "menta_azul.png",
    "lax-mint": "menta_azul.png",
    "relaxed-mint": "menta_azul.png",
    "modest-mint": "menta_cian.png",
    "mild-mint": "menta_cian.png",
    "rash-mint": "menta_cian.png",
    "quiet-mint": "menta_cian.png",
    "calm-mint": "menta_rosa.png",
    "gentle-mint": "menta_rosa.png",
    "careful-mint": "menta_rosa.png",
    "sassy-mint": "menta_rosa.png",
    "timid-mint": "menta_verde.png",
    "hasty-mint": "menta_verde.png",
    "jolly-mint": "menta_verde.png",
    "naive-mint": "menta_verde.png",
    "serious-mint": "menta_amarilla.png",
}

# Orden de preferencia de version_group para decidir qué movimiento (y por tanto qué
# tipo/icono) representa cada slug "tmNN" — el mismo número de MT enseña movimientos
# distintos según el juego (comprobado con SQL: 'tm01' es Puño Certero en Rubí/Zafiro
# pero Golpe en Legends Z-A). Se prioriza scarlet-violet porque es el que da el icono
# "EP" pedido; el resto son fallback solo para los pocos slugs que no tienen entrada
# ahí (ej. 'tm00').
TM_VERSION_GROUP_PRIORITY = ["scarlet-violet", "the-teal-mask", "the-indigo-disk", "legends-za"]

# Las MO (Máquina Oculta) no aparecen desde la séptima generación (se eliminaron del
# juego) — no hay versión "EP" a la que priorizar como con las MT. David pidió
# reutilizar el mismo icono de tipo que su MT correspondiente, así que basta con
# encontrar el movimiento en el juego HM más reciente disponible en caché.
# Las DT (Disco Técnico / "TR" en PokeAPI) solo existieron en Espada/Escudo — un único
# version_group posible, sin nada que priorizar.
TR_VERSION_GROUP_PRIORITY = ["sword-shield"]

HM_VERSION_GROUP_PRIORITY = [
    "brilliant-diamond-shining-pearl", "omega-ruby-alpha-sapphire", "x-y",
    "black-2-white-2", "black-white", "heartgold-soulsilver", "platinum",
    "diamond-pearl", "firered-leafgreen", "emerald", "ruby-sapphire",
    "crystal", "gold-silver", "yellow", "red-blue",
]


def load_machine_type_icons(prefix, version_group_priority):
    """slug '{prefix}NN' -> fichero de icono de tipo, a partir de `machine` (item+
    move+version_group) y el `type` de cada movimiento — ambos recursos ya cacheados
    al 100% en la BD. Genérico para MT y MO (ver TM_VERSION_GROUP_PRIORITY /
    HM_VERSION_GROUP_PRIORITY): el mismo número de máquina enseña movimientos
    distintos según el juego (comprobado con SQL: 'tm01' es Puño Certero en Rubí/
    Zafiro pero Golpe en Legends Z-A), así que hay que fijar un orden de prioridad de
    qué versión manda.
    """
    machines = subprocess.run(
        [
            "docker", "exec", DB_CONTAINER, "mariadb", "-u", DB_USER, f"-p{DB_PASS}", DB_NAME,
            "--batch", "--raw", "-e",
            "SELECT JSON_UNQUOTE(JSON_EXTRACT(payload,'$.item.name')),"
            " JSON_UNQUOTE(JSON_EXTRACT(payload,'$.move.name')),"
            " JSON_UNQUOTE(JSON_EXTRACT(payload,'$.version_group.name'))"
            " FROM pokeapi_resource_cache WHERE resource_type='machine'"
            f" AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.item.name')) LIKE '{prefix}%';",
        ],
        capture_output=True, text=True, check=True,
    )
    move_by_item_and_vg = {}
    for line in machines.stdout.split("\n")[1:]:
        if not line.strip():
            continue
        item, move, version_group = line.split("\t")
        move_by_item_and_vg[(item, version_group)] = move

    move_types = subprocess.run(
        [
            "docker", "exec", DB_CONTAINER, "mariadb", "-u", DB_USER, f"-p{DB_PASS}", DB_NAME,
            "--batch", "--raw", "-e",
            "SELECT name, JSON_UNQUOTE(JSON_EXTRACT(payload,'$.type.name'))"
            " FROM pokeapi_resource_cache WHERE resource_type='move';",
        ],
        capture_output=True, text=True, check=True,
    )
    type_by_move = {}
    for line in move_types.stdout.split("\n")[1:]:
        if not line.strip():
            continue
        move, move_type = line.split("\t")
        type_by_move[move] = move_type

    machine_items = sorted({item for (item, _vg) in move_by_item_and_vg})
    result = {}
    missing = []
    for item in machine_items:
        move = None
        for vg in version_group_priority:
            move = move_by_item_and_vg.get((item, vg))
            if move:
                break
        move_type = type_by_move.get(move) if move else None
        icon = TM_TYPE_ICON.get(move_type) if move_type else None
        if icon:
            result[item] = icon
        else:
            missing.append(item)
    return result, missing


def load_pokeapi_items():
    """[(slug, [es names])] desde la BD ya cacheada."""
    result = subprocess.run(
        [
            "docker",
            "exec",
            DB_CONTAINER,
            "mariadb",
            "-u",
            DB_USER,
            f"-p{DB_PASS}",
            DB_NAME,
            "--batch",
            "--raw",
            "-e",
            "SELECT name, payload FROM pokeapi_resource_cache WHERE resource_type='item';",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    lines = result.stdout.split("\n")
    items = []
    for line in lines[1:]:  # saltar cabecera
        if not line.strip():
            continue
        slug, payload_raw = line.split("\t", 1)
        payload = json.loads(payload_raw)
        es_names = [
            n["name"]
            for n in payload.get("names", [])
            if n.get("language", {}).get("name") in ("es", "es-419")
        ]
        items.append((slug, es_names))
    return items


def main():
    wikidex_by_normalized = load_wikidex_titles()
    print(f"{len(wikidex_by_normalized)} variantes de título de WikiDex cargadas")

    have_icon = existing_objects()
    print(f"{len(have_icon)} iconos locales en {OBJECTS_DIR}")

    items = load_pokeapi_items()
    print(f"{len(items)} objetos de PokeAPI cacheados")

    icon_map = {}
    unmatched = []
    matched_no_icon = 0

    for slug, es_names in items:
        filename = None
        for es_name in es_names:
            candidate = wikidex_by_normalized.get(normalize(es_name))
            if candidate:
                filename = candidate
                break
        if not filename:
            unmatched.append((slug, es_names))
            continue
        if filename not in have_icon:
            matched_no_icon += 1
            continue
        icon_map[slug] = filename

    for slug, filename in MANUAL_OVERRIDES.items():
        if filename in have_icon:
            icon_map[slug] = filename

    tm_icons, tm_missing = load_machine_type_icons("tm", TM_VERSION_GROUP_PRIORITY)
    icon_map.update(tm_icons)

    hm_icons, hm_missing = load_machine_type_icons("hm", HM_VERSION_GROUP_PRIORITY)
    icon_map.update(hm_icons)

    tr_icons, tr_missing = load_machine_type_icons("tr", TR_VERSION_GROUP_PRIORITY)
    icon_map.update(tr_icons)

    mint_icons = {slug: fn for slug, fn in NATURE_MINT_ICON.items() if fn in have_icon}
    icon_map.update(mint_icons)

    print(f"\nemparejados con icono real: {len(icon_map) - len(tm_icons) - len(hm_icons) - len(tr_icons) - len(mint_icons)}")
    print(f"emparejados por nombre pero sin fichero descargado: {matched_no_icon}")
    print(f"sin ningún nombre coincidente en WikiDex: {len(unmatched)}")
    print(f"MTs con icono por tipo: {len(tm_icons)} (sin tipo resuelto: {len(tm_missing)}{': ' + ', '.join(tm_missing) if tm_missing else ''})")
    print(f"MOs con icono por tipo (reutilizando el de la MT): {len(hm_icons)} (sin tipo resuelto: {len(hm_missing)}{': ' + ', '.join(hm_missing) if hm_missing else ''})")
    print(f"DTs con icono por tipo (reutilizando el de la MT): {len(tr_icons)} (sin tipo resuelto: {len(tr_missing)}{': ' + ', '.join(tr_missing) if tr_missing else ''})")
    print(f"Mentas con icono por característica: {len(mint_icons)}")

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(icon_map, f, ensure_ascii=False, indent=1, sort_keys=True)
    print(f"\nescrito {OUTPUT_FILE}")

    unmatched_log = SCRIPT_DIR / "item_icon_map_unmatched.txt"
    with unmatched_log.open("w", encoding="utf-8") as f:
        for slug, es_names in unmatched:
            f.write(f"{slug}\t{' / '.join(es_names)}\n")
    print(f"log de no emparejados: {unmatched_log}")


if __name__ == "__main__":
    main()
