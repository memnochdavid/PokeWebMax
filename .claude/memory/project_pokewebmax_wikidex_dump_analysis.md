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

## Plan de integración acordado

1. ✅ **Hecho (2026-08-17)**: `scripts/wikidex_parser.py` — parser de wikitext puro
   (stdlib, sin dependencias) para `{{Pokédex}}`/`{{Localización}}`. Extracción por
   profundidad de llaves (no heurísticas de `\n}}`), split de campos consciente de
   plantillas anidadas multilínea, resolución de alias y de `NombreHaEs`/`N`/`n`
   (con `[[enlace|pipe]]` anidado dentro del propio parámetro — visto en
   Farfetch'd/Snorunt), limpieza de wikitexto a texto plano. Validado contra el dump
   completo: 1.081 especies con bloque real, 23.289 entradas de descripción y 19.412
   de localización, **0 restos de markup sin limpiar** tras la validación.
   - Bug real encontrado y corregido durante la validación: `find_template_block`
     hacía match por prefijo de nombre, así que `{{Pokédex EP}}` (plantilla de
     episodios de anime, campos `ES`/`HA`/`Pokémon`/`imagen` propios, nada que ver)
     se confundía con `{{Pokédex}}` — inflaba el conteo de especies "con bloque" de
     1081 (real) a 1638 (falsos positivos incluidos) y colaba texto basura como si
     fuera descripción. Corregido comprobando que tras el nombre venga `|` o `}}`
     (ignorando espacios), no más texto.
   - Otro bug real corregido: alias como `NombreHaEs` también aparecen como `N`, `n`
     y `nombreHaEs` en el dump (primera letra insensible a mayúsculas, convención de
     MediaWiki) — el regex inicial solo cubría `NombreHaEs`/`N`.
   - CLI de prueba: `python3 scripts/wikidex_parser.py <Título> [--localizacion]
     [--by-version] [--variant es|ha]`.
2. ✅ **Hecho (2026-08-17)**: `WIKIDEX_KEY_TO_POKEAPI_VERSIONS` en el mismo archivo —
   35 claves WikiDex → 37 slugs `version` de PokeAPI (rojoyazul y lgpe son 1:2).
   **Verificado contra los 53 `version` reales ya cacheados en la BD del propio
   proyecto** (`docker exec pokewebmax_db mariadb -uroot -proot pokewebmax -e
   "SELECT resource_id, name FROM pokeapi_resource_cache WHERE
   resource_type='version'"`), no de memoria — evita typos de slug silenciosos.
   `pokedex_by_pokeapi_version(wikitext)` da el resultado ya indexado por slug de
   PokeAPI, listo para cruzar con `flavor_text_entries[].version.name`. Cobertura
   validada sobre las 1.081 especies: 17.189 entradas mapeadas; solo 10 claves
   sueltas sin cubrir en todo el dump, y son typos reales del wikitext de WikiDex
   (`sleeep`, `slowbro`, `azul` suelto en Mankey, `| generación` con pipe doblado en
   Pikachu con gorra...), no fallos del parser — se ignoran a propósito.
3. ✅ **Hecho (2026-08-17)**: entidad `App\Entity\WikidexFlavorText`
   (`backend/src/Entity/WikidexFlavorText.php`) — tabla `wikidex_flavor_text`
   (`pokemon_species_id`, `version_slug`, `text`, `imported_at`; unique constraint
   `(pokemon_species_id, version_slug)`), separada de `pokeapi_resource_cache` tal
   como anticipaba [[project_pokewebmax_architecture_decisions]]. `pokemonSpeciesId`
   es el `resourceId` real de la fila `pokemon-species` cacheada, no un slug/nombre —
   FK implícita hacia el mismo espacio de ids que usa el resto de la app. Migración
   `Version20260816221109` ya generada y aplicada. Repositorio
   `WikidexFlavorTextRepository` (de momento solo boilerplate + `findOneBySpeciesAndVersion`,
   el método de lectura por especie para el paso 5 se añadirá cuando haga falta).
4. ✅ **Hecho (2026-08-17), decisión tomada: Python para el parseo, PHP solo para el
   cruce y la escritura** — no se tocó `backend.Dockerfile` (sin `pdo_sqlite`).
   - `scripts/wikidex_export_flavor_text.py`: reusa `wikidex_parser.py`
     (`pokedex_by_pokeapi_version`) y vuelca todas las páginas con bloque `{{Pokédex}}`
     real a `backend/var/wikidex_import/flavor_text.json` (`[{"title", "versions":
     {slug: texto}}, ...]`). Ese path cae dentro de `backend/var/` (ya gitignorado)
     porque `docker-compose.yml` solo monta `./backend`, no `./scripts` — el JSON
     tiene que estar dentro del volumen del contenedor backend para que el comando
     Symfony lo vea.
   - `App\Command\WikidexImportCommand` (`bin/console app:wikidex:import [jsonPath]`):
     cruza cada `title` contra `PokeApiResourceCacheRepository::findSpeciesLocalizedNames(['es'])`
     (nombre en español ya cacheado, comparación por igualdad exacta — funcionó sin
     normalizar comillas: PokeAPI y WikiDex usan el mismo `’` U+2019 curvo para
     Farfetch’d) y hace upsert en `wikidex_flavor_text`. Precarga todas las filas
     existentes en memoria antes del loop (evita 17k SELECT sueltos). Idempotente —
     re-ejecutar no duplica filas, verificado con dos ejecuciones seguidas.
   - **Gotcha real encontrado al ejecutarlo**: con las ~17k entradas en un solo
     `flush()`, el profiler de Doctrine en modo dev (`APP_ENV=dev`, backtrace por
     query en `BacktraceDebugDataHolder`) agota el `memory_limit` de PHP por defecto
     (128M) — hace falta `-d memory_limit=768M` al invocar `bin/console` para este
     comando en concreto. Ya envuelto en `scripts/import_wikidex.sh` (encadena los
     dos pasos, exportar + importar), así que no hay que recordarlo a mano.
   - **Resultado real de la primera importación**: 1025/1025 `pokemon-species`
     cacheadas cruzadas con éxito (100%), 16.943 filas escritas. 56 títulos de
     WikiDex sin cruzar — todos formas regionales con página propia en WikiDex
     (Raichu de Alola, Corsola de Galar, Pikachu con gorra...) que en PokeAPI NO son
     una `pokemon-species` independiente sino una variante/forma de la especie base;
     PokeAPI tampoco tiene flavor text por forma, así que no hay donde encajarlas con
     el modelo de datos actual — limitación conocida, no bug del importador.
5. ✅ **Hecho (2026-08-17)**: encaje en el flujo ya existente.
   - `WikidexFlavorTextRepository::findTextsBySpeciesId(int $speciesId): array`
     (versionSlug -> texto), usada en `PokemonFichaAssembler::assemble()`: la ficha
     ahora incluye `wikidexFlavorText` (array vacío si la especie no está cacheada).
   - `flavorTextsByVersion(species, language, wikidexFlavorText = {})` en
     `frontend/src/utils/pokemonFicha.js` gana el tercer nivel: si PokeAPI no tiene
     `language` para esa versión y `language === 'es'`, usa el texto de WikiDex y lo
     marca `translated: true` (es español real, solo que de otra fuente — no lleva
     el tag "EN"). `PokemonFichaPage.jsx` pasa `ficha.wikidexFlavorText` a la llamada.
   - **Verificado con datos reales** (no simulado): ejecutando el módulo JS real
     contra la ficha real de Bulbasaur devuelta por el backend, `red/yellow/gold/
     silver/crystal/ruby/firered/diamond` pasaron de `translated: false` (inglés) a
     `translated: true` (español, vía WikiDex), y `leafgreen` apareció en el selector
     por primera vez (PokeAPI no tenía ninguna entrada para esa versión, ni en
     inglés).

**Estado (2026-08-17): plan completo, pasos 1-5 hechos y verificados con datos
reales** (16.943 filas en `wikidex_flavor_text`, fallback funcionando end-to-end en
la ficha de Bulbasaur). Reimportar tras regenerar el dump: `bash
scripts/import_wikidex.sh`. Posible trabajo futuro no pedido todavía: las 56 formas
regionales sin cruzar (punto 4) y la pestaña de Ubicaciones con `{{Localización}}`
(el parser ya lo soporta vía `parse_localizacion()`, solo falta el mismo cableado de
exportación/importación/frontend que este documento describe para descripciones).
