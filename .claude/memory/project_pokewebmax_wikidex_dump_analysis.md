---
name: project_pokewebmax_wikidex_dump_analysis
description: Análisis del dump local de WikiDex (scripts/wikidex_dump/) y plan concreto de cómo usarlo para rellenar los huecos de español de PokeAPI
metadata:
  type: project
---

Sesión 2026-08-16 (continuación): David ya había descargado él mismo, con su propio
script `scripts/dump_wikidex.py` (1703 líneas, usa la API oficial de MediaWiki
`api.php`, NO scraping de HTML), un volcado completo de WikiDex. Claude lo examinó
(archivos ya en disco, sin descargar nada nuevo) para planear la integración pendiente
de [[project_pokewebmax_progress]] ("Siguiente sesión: fallback a WikiDex").

## Qué contiene el dump

- `scripts/wikidex_dump/wikidex.sqlite` (~446MB) + espejo en `pages/*.json` (37.571
  archivos): TODO el namespace principal de WikiDex (fichas de especie, cartas TCG,
  episodios de anime, personajes...), no solo Pokémon.
- Tablas: `pages` (page_id, namespace, title, canonical_url, redirect, revision_id,
  revision_timestamp, **wikitext** crudo, html=NULL porque se corrió con `--no-html`,
  downloaded_at), `categories`, `page_links`, `metadata`, más índice FTS5
  (`pages_fts`). Es wikitext de MediaWiki sin parsear, no HTML ni JSON estructurado —
  cualquier extracción hay que hacerla nosotros.
- **Importante para la decisión de arquitectura:** el dump ya está completo en disco.
  Integrarlo NO requiere que el backend haga ninguna petición en vivo a wikidex.net.
  Esto vuelve moot la advertencia de la sesión anterior sobre el `robots.txt` que
  bloquea `ClaudeBot` (ver nota en [[project_pokewebmax_progress]]) — no hace falta
  suplantar ningún User-Agent, es una importación offline de datos que David ya obtuvo
  él mismo con su script.

## El cruce con PokeAPI funciona por nombre exacto, sin mapeo manual

El `title` de cada página en WikiDex coincide EXACTAMENTE con el nombre en español que
ya tenemos cacheado de PokeAPI (`species.names[language=es]`). Verificado con casos
límite: `Nidoran♂`/`Nidoran♀`, `Farfetch’d` (con comilla curva `’`, cuidado al
normalizar), `Código Cero` (Type: Null), `Raichu de Alola`, `Mr. Mime`, `Tapu Koko`.
**How to apply:** el join es `species.names[es].name` → `pages.title` (exact match,
normalizando comillas si hace falta), no hace falta tabla de mapeo de nombres.

**Aviso de cobertura:** intentar detectar "páginas de especie" vía la tabla
`categories` de WikiDex (p.ej. `Categoría:Pokémon de primera generación`) solo
encontró 412 páginas de ~1025 especies esperadas — la tabla `categories` del dump
parece incompleta/parcial (quizás por cómo quedó a medias el crawl, ver
`metadata.resume_title='► A'`). **No usar `categories` para decidir qué importar** —
mejor iterar sobre la lista de especies que ya tenemos en `pokeapi_resource_cache`
(species cacheadas) y buscar cada una por nombre exacto en `pages.title`.

## Estructura de la plantilla `{{Pokédex}}` (descripciones por juego)

Cada ficha de especie tiene una sección `== Descripción Pokédex ==` con un bloque
`{{Pokédex\n| clave = valor\n...}}`. Claves observadas (muestreo de 410 fichas de
especie), agrupadas:

- **Mapeables 1:1 a `version` de PokeAPI:** `rojoyazul, amarillo, oro, plata, cristal,
  rubí, zafiro, esmeralda, rojofuego, verdehoja, diamante, perla, platino, "oro
  heartgold", "plata soulsilver", negro, blanco, "negro 2", "blanco 2", x, y, sol,
  luna, ultrasol, ultraluna, "rubí omega", "zafiro alfa", "leyendas Arceus", espada,
  escudo, "diamante brillante", "perla reluciente", escarlata, púrpura, "leyendas ZA"`.
- **`lgpe` es 1:2** — una sola clave WikiDex cubre las dos versiones PokeAPI
  (let's-go-pikachu / let's-go-eevee).
- **Sin equivalente en `version` de PokeAPI (spin-offs), no van al selector de
  juego pero se podrían guardar como extra:** `go, ranger, ranger2, ranger3,
  pinballrz, stadium, "stadium 2", masters, sleep, pokopia, "new snap"`.

**Casos especiales del valor de cada clave** (el parser tiene que manejarlos):
1. **Alias a otra clave**: el valor es literalmente el nombre de otra clave, p.ej.
   `zafiro = rubí` o `verdehoja = rojoyazul` (usar el texto de esa otra clave). Un
   nivel de indirección basta en todo lo visto, pero conviene resolver de forma
   recursiva por seguridad.
2. **`"no hay"`**: sin entrada en ese juego para esa especie/forma (ej. formas
   regionales que no salen en Escarlata/Púrpura) — tratar como ausente, no como texto.
3. **Subplantilla `{{NombreHaEs|variante1|variante2}}`** (o su gemela `{{N|...|...}}`):
   da dos variantes de español regional. Por el orden del nombre de la plantilla
   (Ha=Hispanoamérica antes que Es=España) probablemente variante1=Hispanoamérica,
   variante2=España — sin confirmar al 100%, pero PokeAPI usa un único `es` genérico,
   así que hay que elegir una consistente (recomendado: España, por ser más cercano al
   tono que ya usa PokeAPI) o guardar ambas si se quiere ampliar el selector de idioma
   más adelante.
4. Limpieza de wikitexto normal: `[[enlace|texto visible]]` → texto visible, `''cursiva''`
   → texto plano, `<ref>...</ref>` → descartar, `<br />` → salto de línea/espacio.

## Bonus no pedido: `{{Localización}}` para la pestaña Ubicaciones

Misma estructura (una clave por juego) en la sección `== Localización ==` de cada
ficha, con texto de dónde/cómo conseguir a ese Pokémon en cada juego. Es justo la
fuente que el doc `docs/reference-android/wikidex-scraping-system.md` marcaba como
**primaria** (no fallback) para Ubicaciones — pestaña que sigue pendiente en la ficha
(ver [[project_pokewebmax_progress]]). Mismo parser reutilizable (mismo formato
clave=valor con alias y wikitexto).

## Plan de integración acordado (pendiente de implementar)

1. Mini-parser de wikitext en PHP (o Python, ver más abajo) para el bloque
   `{{Pokédex}}`/`{{Localización}}`: split por líneas `| clave = valor`, resolver
   alias, resolver `NombreHaEs`/`N`, limpiar markup, descartar `"no hay"`.
2. Tabla de mapeo clave-WikiDex → `version` slug de PokeAPI (la lista de arriba).
3. **Nueva entidad Doctrine pequeña, NO la tabla genérica `pokeapi_resource_cache`**
   (esto no es un recurso de PokeAPI, es de WikiDex — coincide con lo que ya
   anticipaba [[project_pokewebmax_architecture_decisions]] punto sobre WikiDex).
   Algo como `WikidexFlavorText` (nombre especie/slug, versionSlug o claveWikidex
   cruda, texto).
4. **Comando de importación offline** (`bin/console app:wikidex:import` o similar) que
   lee `wikidex.sqlite` directamente y puebla esa tabla — una sola vez (o
   re-ejecutable si se regenera el dump). Nunca hace peticiones en vivo a wikidex.net.
   Detalle técnico pendiente de decidir: el contenedor backend solo tiene
   `pdo_mysql`, no `pdo_sqlite` — o se añade la extensión al `backend.Dockerfile`, o
   se hace el parseo en Python (ya usado en el proyecto para el propio dump) volcando
   a JSON/CSV intermedio que el comando de Symfony importa a MariaDB.
5. Encaje final en el flujo ya existente: `flavorTextsByVersion()`
   (`utils/pokemonFicha.js`, ver sección "Fallback de descripción por versión" de
   [[project_pokewebmax_progress]]) gana un tercer nivel — PokeAPI-ES → WikiDex-ES →
   PokeAPI-EN — en vez de caer directo a inglés cuando PokeAPI no tiene español.

**Not empezado todavía**: David cortó la sesión aquí (surgió algo urgente) justo
después de acordar el plan de arriba, antes de escribir ningún código. La siguiente
sesión puede arrancar directo por el paso 1 (parser) sin tener que re-examinar el
dump — todo lo necesario (estructura, claves, casos especiales, decisión de
arquitectura) ya está en esta nota.
