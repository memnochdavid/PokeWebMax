---
name: project_pokewebmax_progress
description: Estado de avance de PokeWebMax — qué está montado y qué falta. Actualizar cada sesión.
metadata:
  type: project
---

Última actualización: 2026-08-17.

## Hecho

- Estructura del repo: `backend/` (Symfony), `frontend/` (React/Vite), `docker/`
  (Dockerfiles), `docs/reference-android/` (docs copiados del proyecto Android, solo
  lectura/referencia), `scripts/`, `docker-compose.yml` en la raíz.
- `docker/backend.Dockerfile`: idéntico al de ZenPaw (`php:8.4-cli` + `pdo pdo_mysql intl
  zip mbstring`, `$PHPIZE_DEPS` + `libicu-dev libzip-dev libonig-dev`).
- `docker/frontend.Dockerfile`: `node:22-alpine`. CMD especial, ver más abajo (fuseblk).
- Backend scaffolded: `symfony/skeleton` + `orm-pack`, `maker-bundle` (dev), `validator`,
  `serializer-pack`, `nelmio/cors-bundle`. **Sin** security-bundle ni JWT — no se ha
  pedido auth (ver [[project_pokewebmax_architecture_decisions]]).
- Frontend scaffolded con Vite (`--template react`) + `react-router-dom` + `axios`. CSS
  Modules, no Tailwind. `vite.config.js` con `server.host: true` y proxy `/api` →
  `http://backend:8000`.
- Se borraron `backend/compose.yaml`/`compose.override.yaml` (postgres autogenerado por
  symfony flex, mismo caso que en ZenPaw).
- Puertos: backend `8001`, frontend `5174`, MariaDB `3307` (distintos de ZenPaw a
  propósito, para poder correr ambos proyectos a la vez).
- `scripts/init.sh` + `migrate.sh` + `make_migration.sh` + `clear_cache.sh` creados y
  `init.sh` probado end-to-end con éxito (los 3 contenedores arriba, backend responde 404
  esperado, frontend 200).
- Repo git inicializado, remoto `origin` → `github.com/memnochdavid/PokeWebMax.git`, rama
  `master`. A fecha de esta nota hay cambios sin commitear (todo lo de esta sesión: la
  entidad/servicio de caché, el endpoint, y el frontend con routing) — David gestiona sus
  propios commits, no crear commits sin que lo pida explícitamente.

## Hallazgo importante: filesystem fuseblk

`/home/david/Escritorio/WORKSPACE/` está montado sobre un filesystem `fuseblk` (NTFS vía
FUSE, aparece como `/media/david/...` por debajo) que **no soporta permisos/propietario
Unix reales**. `chmod +x` y `chown` no dan error pero tampoco persisten.
Consecuencias prácticas ya resueltas:
- Los scripts de `scripts/` no se pueden marcar ejecutables: hay que invocarlos como
  `bash scripts/init.sh`, nunca `./scripts/init.sh`.
- `node_modules/.bin/vite` (symlink a un JS sin bit +x) no se puede ejecutar directamente
  desde `npm run dev`. Por eso `docker/frontend.Dockerfile` invoca
  `node node_modules/vite/bin/vite.js --host 0.0.0.0` en vez de `npm run dev`. Si en el
  futuro se necesita ejecutar cualquier otro binario de `node_modules/.bin/` (jest, eslint,
  etc.) dentro de Docker, aplicar el mismo patrón: `node node_modules/<paquete>/bin/<...>.js`
  en vez de invocar el shim directamente.
- No tiene sentido añadir pasos de `chown` al final de `init.sh` en este proyecto — se
  quitaron deliberadamente (sí existen en el `init.sh` de ZenPaw porque ese repo está en
  un filesystem normal).

**How to apply:** si se copia cualquier patrón de scripts/Docker desde ZenPaw a este
proyecto, revisar primero si depende del bit +x o de chown/permisos reales — aquí hay que
adaptarlo.

## Historial de iteraciones sobre el cacheo (superseded)

Antes de llegar al diseño actual hubo varias vueltas en la misma sesión (2026-08-15): v1
cacheaba un único Pokémon con upsert real hacia PokeAPI; luego se corrigió a "no tocar lo
ya cacheado"; luego se probó un listado completo de Pokémon con botón de cacheo por-item
en la propia lista. Todo eso quedó reemplazado por el diseño genérico de la sección
siguiente — no hace falta detalle de esas versiones intermedias, solo el resultado final.

## Diseño final: caché genérica multi-recurso — HECHO 2026-08-15

David pidió examinar `DexterWeb` (proyecto anterior suyo, mismo planteamiento
Symfony+React, repo en `github.com/memnochdavid/DexterWeb.git`) para ver qué reutilizar, y
a raíz de eso decidió que **el objetivo ya no es cachear solo Pokémon, sino toda la
PokeAPI** (~50 recursos). Esto llevó a repensar la arquitectura de caché desde cero — ver
punto 8 de [[project_pokewebmax_architecture_decisions]] para el detalle completo. Resumen:

- **Una sola tabla genérica** `pokeapi_resource_cache` (`App\Entity\PokeApiResourceCache`):
  `resourceType` + `resourceId` + `name` + `payload` (JSON crudo de PokeAPI, sin parsear a
  columnas propias) + `fetchedAt`. Índice único `(resourceType, resourceId)`. Sustituye a
  la antigua `pokemon_cache` (borrada en la misma migración, `Version20260815144432` —
  solo tenía datos de prueba, sin pérdida real).
- Todo el backend quedó parametrizado por `resourceType` en vez de duplicado por recurso:
  `PokeApiClient::fetchResource()`/`fetchResourceList()`, `PokeApiCacheService::cache()`
  (sigue sin hacer upsert — si ya existe no vuelve a PokeAPI), `PokeApiListService::listAll()`
  (deliberadamente ligero: solo `id/name/cached/fetchedAt`, sin `payload`, porque algunos
  recursos tienen miles de entradas — `item` ~2100, `pokemon-form` ~2000). Endpoints:
  `GET /api/pokeapi/{resourceType}`, `POST /api/pokeapi/{resourceType}/cache/{idOrName}`.
  Comando: `app:cache:resource {resourceType} {idOrName}`.
- Se borraron todos los archivos específicos de Pokémon del diseño anterior
  (`PokemonCache`, `PokemonCacheRepository`, `PokemonCacheMapper`, `PokemonCacheService`,
  `PokemonCacheResult`, `PokemonListService`, `PokemonCacheController`,
  `PokemonListController`, `CachePokemonCommand`, `PokemonNotFoundException` → renombrada a
  `ResourceNotFoundException`, ahora genérica).
- **Primero se activaron 5 recursos "grandes"** (`pokemon-species`, `move`, `item`,
  `berry`, `ability`), pero David pidió después "añade todo" — **los 49 recursos reales
  de PokeAPI tienen ahora botón de cacheo masivo** (todo salvo `meta`, que es solo info
  de deploy de la API, no un recurso de dominio). Esto fue trivial gracias al diseño
  genérico: no hizo falta ninguna entidad/migración nueva, solo listar los 49
  `resourceType` en el frontend.
- Frontend: vista **Cachear** (`CacheAllPage`) agrupa los 49 recursos en 10 secciones
  (Pokémon, Movimientos, Ítems, Bayas, Ubicaciones, Encuentros, Evolución, Concursos,
  Partidas, Utilidad — mismo agrupado que la doc oficial de PokeAPI), cada uno con su fila
  de botón+progreso independiente. El array de recursos vive en
  `frontend/src/utils/pokeApiResources.js` (`RESOURCE_GROUPS`) — es la única fuente de
  verdad de "qué recursos tiene la app", añadir uno nuevo es solo añadir una línea ahí.
  `hooks/useCacheAllResource.js` generalizado (recibe `resourceType`).
- Vista **Pokémon** (`PokemonListPage`) consume `GET /api/pokeapi/pokemon-species`; el
  sprite se deriva por **URL determinista** (`.../official-artwork/{id}.png`, sin
  payload) — pero **perdió el campo "tipos"** en la card, porque `pokemon-species` no lo
  tiene (vive en el recurso `pokemon`, que sí está cacheable ahora pero no se usa todavía
  en esta vista). Pendiente si se quiere recuperar.
- **Bug encontrado y arreglado en la misma sesión**: `PokeApiListService::listAll()`
  cargaba las entidades completas (con el `payload` JSON entero) solo para saber qué
  estaba cacheado — con 1025 Pokémon (~28MB) + cientos de Movimientos ya cacheados, la
  hidratación de Doctrine agotaba el `memory_limit` de PHP (128MB) y el listado devolvía
  "Error inesperado." en el frontend. Arreglado con
  `PokeApiResourceCacheRepository::findFetchedAtByType()`, que solo trae
  `resourceId`+`fetchedAt` vía `getArrayResult()` (sin hidratar entidades, sin tocar
  `payload`). **Why importante:** con el diseño genérico y recursos de miles de filas
  (`item` ~2200, `location-area` ~1500), cualquier query futura sobre esta tabla debe
  evitar cargar `payload` a menos que se necesite explícitamente esa ficha — es la
  columna cara.
- **5 recursos sin campo `name`** en PokeAPI (ni en el detalle ni en el listado, solo
  `id`): `contest-effect`, `super-contest-effect`, `evolution-chain`, `machine`,
  `characteristic`. `PokeApiClient`/`PokeApiCacheService` usan un nombre sintético
  `{resourceType}-{id}` (ej. `"evolution-chain-1"`) como fallback — sin este fallback el
  cacheo de estos 5 fallaba con TypeError (`setName(null)`).
- Verificado con `curl`: los 49 recursos listan y cachean correctamente, incluidos los 5
  "sin nombre" y el bug de memoria confirmado arreglado (`pokemon-species` 1025/1025 sin
  error). Frontend sirve `/cache` sin errores de import. **No verificado a ojo en
  navegador** en ningún momento de esta sesión (Chrome no conectado,
  `claude-in-chrome` sin configurar).

**Nota de seguridad (no accionada, solo registrada):** al revisar `DexterWeb` (proyecto
anterior de David, mismo planteamiento) se encontró `backend/config/jwt/private.pem` + su
passphrase en claro en `backend/.env`, commiteados en un repo público de GitHub — clave
privada JWT expuesta. Es un proyecto distinto a PokeWebMax y no se ha tocado; David fue
avisado en la conversación pero no ha pedido rotarla/purgarla todavía.

## Ficha de Pokémon (composición desde caché) — HECHO 2026-08-16

Primer incremento de la vista "ficha" (ver puntos 9-11 de
[[project_pokewebmax_architecture_decisions]] para el porqué de diseño). Backend:
`PokeApiUrl::idFromUrl()` (helper compartido, antes duplicado en `PokeApiClient`),
`PokemonNotCachedException`, `PokemonFichaAssembler` (`GET
/api/pokemon/{idOrName}/ficha` — compone pokemon+species+evolution-chain+moves+
abilities+forms desde la caché, sin llamar a PokeAPI), `PokemonFichaCacheService`
(`POST /api/pokemon/{idOrName}/ficha/cache-missing` — cachea de un tirón lo que falte
y devuelve la ficha ya completa). Probado con curl contra Pikachu (id 25): evolution-
chain y una forma salieron `cached: false` antes del botón, `cached: true` después.

Frontend: `usePokemonFicha` (fetch + acción cachear-lo-que-falta),
`useFichaSection` (estado de pestaña activa — se extrajo a hook aunque es UI pura, para
cumplir la norma de la decisión 7 de "nada de useState en el cuerpo del componente"),
utils puros `pokemonTypes.js`/`pokemonFormat.js`/`pokemonFicha.js` (helpers de
formato/derivación, no necesitan ser hooks por no tener estado). Página
`PokemonFichaPage` en `/ficha/:idOrName`: cabecera con gradiente por tipo dual, 6
pestañas (`DESC, STATS, EVOS, MOVES, ABILITY, FORM` — **falta `INTER`**, pendiente
porque necesita cruzar con el recurso `type`, que el ensamblador no resuelve todavía),
cada pestaña con badge rojo de cuántos recursos le faltan, y una barra superior con
botón "Cachear todo lo que falta" si `missingTotal > 0`.

`PokemonListPage` ahora usa el componente `PokemonCard` nuevo (antes era un `<li>`
suelto) y cada card navega a `/ficha/:id` al pulsar.

**Verificado:** rutas registradas (`debug:router`), tres llamadas curl (ficha con
huecos, cache-missing rellenándolos, pokemon no cacheado → 404 con mensaje claro), Vite
compila sin errores (`docker compose logs frontend` sin warnings), y las 3 páginas
(`/pokemon`, `/ficha/25`, asset SVG de tipo) devuelven 200 por curl contra el dev
server. **No verificado a ojo en navegador** — Chrome no conectado en esta sesión
tampoco (mismo hueco que la sesión anterior).

**Pendiente de esta pieza:**
- Pestaña `INTER` (tabla de tipos/debilidades) — falta resolver el recurso `type` en
  el ensamblador (solo 1 fila de `type` cacheada en la BD ahora mismo, de 18).
- `flattenEvolutionChain()` en `utils/pokemonFicha.js` es lineal (solo sigue
  `evolves_to[0]`) — no muestra ramas alternativas (ej. Eevee con 8 evoluciones).
- Solo 1 fila de `evolution-chain` estaba cacheada en la BD antes de esta sesión — la
  mayoría de Pokémon mostrarán "cadena evolutiva no cacheada" hasta que el usuario pulse
  el botón de cachear-lo-que-falta en cada ficha (o se cachee `evolution-chain` en
  bloque desde `/cache`).

## Correcciones sobre la ficha, la misma sesión 2026-08-16

David probó `/pokemon` y `/cache` a mano en el navegador (sin `claude-in-chrome`
conectado todavía en esa comprobación) y encontró dos huecos sobre lo recién montado:

1. **La lista de Pokémon se veía gris** — `pokemon-species` no tiene `types`, así que
   `PokemonCard` caía siempre al degradado gris por defecto. Arreglado con
   `PokeApiResourceCacheRepository::findPokemonTypesById()` (usa `JSON_EXTRACT` en la
   propia consulta SQL para proyectar solo el array `types` de cada fila de
   `resource_type='pokemon'`, sin hidratar el payload de ~28KB por Pokémon — mismo
   cuidado de memoria que `findFetchedAtByType`) + `PokemonListService`/
   `PokemonListController` nuevos (`GET /api/pokemon`, específico de Pokémon, análogo a
   `PokemonFichaController` bajo el mismo prefijo — no confundir con el genérico
   `PokeApiListController` de `/api/pokeapi/{resourceType}`). Asume que el id de
   `pokemon-species` coincide con el de su variante por defecto en `pokemon` — cierto
   para las ~1025 especies base. `usePokemonList` ahora apunta a `/api/pokemon` en vez
   de `/api/pokeapi/pokemon-species`.
2. **La vista `/cache` no tenía un botón único que cacheara los 49 recursos de un
   tirón** — cada recurso tenía su fila+botón independiente, pero ninguno los cubría
   todos. Se extrajo la lógica compartida `cacheAllPending()` a
   `utils/cachePokeApiResource.js` (antes vivía solo dentro de `useCacheAllResource`) y
   se añadió `useCacheEverything` (recorre los 49 `resourceType` en secuencia,
   reutilizando esa misma función) + una fila "Todo (49 recursos)" arriba del todo en
   `CacheAllPage` con su propia barra de progreso y el resourceType actual visible.

**Sigue sin verificarse a ojo en navegador con `claude-in-chrome`** — se intentó
conectar la extensión varias veces en esta sesión (incluso tras instalarla en Brave) y
nunca apareció como herramienta disponible; hace falta reiniciar la sesión de Claude
Code para que la recoja. Todo lo de esta sección se verificó por curl contra el backend
y contra el dev server de Vite (200s, JSON con los campos esperados), no visualmente.

## Sprites estilo HOME (projectpokemon.org) — HECHO 2026-08-16

David quería los sprites estilo Switch/SV-HOME de `projectpokemon.org` en vez de los de
PokeAPI. **Claude se negó a descargarlos/scrapearlos** (y a depurar el script scraper
que David escribió él mismo) — son assets con copyright de Nintendo/Game Freak/
Creatures, y el repo es público en GitHub; bajarlos en bloque (aunque el uso final sea
personal) sería Claude reproduciendo ese material. Se ofreció como alternativa gratuita
el sprite `home` que el propio repo `PokeAPI/sprites` ya expone por URL
(`.../sprites/pokemon/other/home/{id}.png`) — David lo rechazó explícitamente, quiere
los de projectpokemon en concreto. **Resuelto**: David los descargó él mismo
manualmente y los dejó en `frontend/public/sprites_home/gen{1-9}/{id_4digitos}.png`
(1334 archivos, patrón `{id}.png` para forma base y `{id}_{01,02...}.png` para
variantes — mega/regional/gigamax, sin usar todavía). Carpeta añadida a `.gitignore`
(nunca se sube al repo público). Claude solo examinó los *nombres* de archivo ya
descargados (no el contenido) para deducir el patrón y detectar anomalías: `3730.png`
(fuera de rango de Pokédex), 3 archivos con nombre hash tipo
`597271...PSMDPortrait*.png` (parecen retratos de Mystery Dungeon, no sprites HOME) y
`react_like.png` (no es un sprite de Pokémon) — mezclados en el pack descargado, sin
tocar. **Why:** distinguir claramente qué acción sí es aceptable (leer/usar archivos
locales que el usuario ya puso él mismo) de la que no (que Claude sea quien los
obtenga), incluso cuando el argumento es "solo es para mí" o "hazme un script para no
ser tú técnicamente" — ninguno de los dos cambia la respuesta.

Implementado: `utils/spritesHome.js` (`spriteHomeUrl(id)` — resuelve
`/sprites_home/gen{N}/{id}.png` por rango de generación, sin tocar variantes `_01` etc.
todavía) + `hooks/useImageFallback.js` (hook genérico: intenta `primarySrc`, si el
`<img>` dispara `onError` cae a `fallbackSrc` — se extrajo a hook en vez de `useState`
inline en el componente para cumplir la decisión 7). `PokemonCard` y la cabecera de
`PokemonFichaPage` ahora prueban primero el sprite local y caen a PokeAPI
(`official-artwork`) si ese Pokémon en concreto no está en el pack. **How to apply:**
si se quiere aprovechar el sufijo `_01`/`_02` (formas especiales) más adelante, hace
falta un mapeo forma→sufijo que hoy no existe (el ensamblador de ficha no distingue
"esta es la mega X, usa `_02`").

## Sprite animado del banner de ficha — HECHO 2026-08-16

Mismo día, continuación de lo anterior: David copió manualmente `frontend/public/
animated/` (1505 archivos `.webm` + un `ability.json` que resultó ser una animación
Lottie suelta, no un sprite — se dejó sin tocar) desde su propio clon temporal de
`Dexter` (el que Claude clonó antes en el scratchpad para leer código, ver más arriba)
para usarlo como sprite del banner de la ficha. Carpeta añadida a `.gitignore` junto
con `sprites_home/` (mismo motivo: copyright Nintendo/Game Freak/Creatures).

Los nombres de archivo siguen el patrón de `transformPokemonNameToResourceName()` de
`SpriteWebm.kt` (Dexter) — Claude leyó esa función (es código del propio David, no
contenido con copyright) y la portó a `utils/animatedSprite.js` como
`animatedSpriteResourceName()`/`animatedSpriteUrl()`, con un cambio deliberado: el
Kotlin original recibía el nombre *localizado en español* de la especie, pero ese dato
no cubre las formas (PokeAPI no tiene nombre en español para "raichu-alola" etc.), así
que la versión JS parte del slug en inglés de PokeAPI (`pokemon.name`, siempre
disponible) — verificado contra el pack real que el patrón de sufijos (`_de_alola`,
`_hembra`/`_macho`, `_escudo`, `_z`, `_mega_...`) coincide igual partiendo del slug
inglés (comprobado con `mr_mime_de_galar`, `nidoran_hembra/macho`, `porygon_z`,
`jangmo_o`, `tapu_koko`...). Única excepción real encontrada: Type: Null → el archivo
es `codigo_cero.webm` (su nombre oficial en español), no derivable del slug inglés
`type-null` — se resolvió con una tabla `NAME_OVERRIDES` explícita en vez de intentar
portar el caso especial por substring que usaba el Kotlin original (dependía del
nombre en español, que ya no es el input).

Componente `PokemonHeroSprite` (usa `hooks/useVideoFallback.js`, con el mismo patrón
de "hook para el estado, no `useState` inline" que el resto de la sesión): intenta el
`.webm` local; si no existe o falla, cae al `<img>` estático (que a su vez ya tenía su
propio fallback a PokeAPI vía `useImageFallback`, ver sección anterior) — dos niveles
de fallback en cascada. Verificado por curl que `/animated/pikachu.webm` sirve 200 y
que la ficha sigue compilando sin errores. **No verificado a ojo** (mismo hueco de
`claude-in-chrome` de toda la sesión).

**Nota de proceso importante:** David pidió varias veces en esta sesión que Claude
descargara/scrapeara estos assets (de projectpokemon.org, y luego depurar un script
scraper que él mismo escribió) — Claude se negó las veces, incluyendo cuando David
argumentó "es solo para mí" y "hazme un script para que no seas tú técnicamente".
Ninguno de esos argumentos cambió la respuesta: la línea es que sea David quien
obtenga el archivo (desde su navegador o copiando de uno de sus propios repos), nunca
Claude. En cuanto David lo puso él mismo en `public/`, Claude examinó nombres de
archivo libremente y cableó el código sin problema. **How to apply:** mantener esta
misma línea si se piden más assets con copyright (audio, más sprites, texturas...) en
el futuro.

## Transparencia del banner animado — HECHO 2026-08-16

Los `.webm` de `animated/` se veían con fondo blanco en vez de transparente. Causa: el
elemento `<video>` de HTML5 no puede mostrar canal alfa aunque el archivo lo tenga —
limitación del elemento, no de los archivos (encaja con que `SpriteWebm.kt` en Dexter
necesitara hacks de "Setting Opaque to false" en el TextureView de Android, indicio de
que sí llevan alfa real). Se presentaron dos opciones a David (chroma-key por canvas,
sencillo pero puede recortar blancos reales del sprite; vs. WebCodecs `VideoDecoder`
con el alfa real, solo Chrome/Edge y mucho más complejo) — **eligió chroma-key**.

Implementado: `hooks/useChromaKeyVideo.js` (dibuja cada frame del `<video>` oculto en
un `<canvas>`, y por píxel hace transparente lo casi-blanco con un umbral suave —
`WHITE_LOW=235`/`WHITE_HIGH=250` — para no dejar un corte duro en el borde). `
PokemonHeroSprite` ahora renderiza el `<video>` real oculto (fuera de pantalla, no
`display:none`, por compatibilidad con Safari/iOS al capturar frames) + el `<canvas>`
visible con el resultado. **Trade-off asumido y conocido:** puede recortar partes
genuinamente blancas del propio sprite (ojos, dientes, pelaje claro) — si se nota
mucho en la práctica, ajustar `WHITE_LOW`/`WHITE_HIGH` en ese archivo, o replantear
hacia WebCodecs si algún día compensa la complejidad.

## Rediseño visual de la ficha para imitar a Dexter — HECHO 2026-08-16

David compartió 9 capturas de pantalla suyas (`/home/david/Escritorio/capturas/`, ficha
de Bulbasaur en Dexter) y pidió imitar esa apariencia. Dexter tiene 9 pestañas:
Descripción, Evolución, Stats, Habilidades, Movimientos, Tipos, Info, Ubicaciones,
Sprites — más que las 6 que teníamos. Rediseñado con lo que el ensamblador ya resuelve
(quedan pendientes Tipos/Ubicaciones/Sprites, ver abajo):

- **Cabecera**: dos bandas horizontales de color por tipo (antes degradado diagonal),
  banda inferior sólida con nombre + número + género + chip de generación (`G-N`,
  `utils/pokemonFicha.js#generationNumber`, parsea `species.generation.name`) + chips
  de altura/peso — replica el layout de Dexter. **Deliberadamente NO se replicaron**
  los botones decorativos de pokeball/shiny ni los fondos animados por tipo (18
  overlays, ver `RUTA_FONDOS_ANIMADOS.md`) — fuera de alcance para este incremento.
- **Pestañas**: de subrayado a píldoras (fondo del color de tipo cuando está activa),
  como en Dexter.
- **Descripción**: ahora con selector de versión de juego (texto, no carátulas — no se
  van a descargar carátulas de juego, mismo criterio que con los sprites). Colapsa
  versiones con texto idéntico en una sola pastilla
  (`spanishFlavorTextsByVersion`) en vez de mostrar 20+ casi duplicadas.
- **Evolución**: de una línea de texto plana a cards apiladas con sprite + nombre +
  número (navegables, enlazan a la ficha de esa etapa) conectadas por el método de
  evolución (`evolutionStages` en `utils/pokemonFicha.js` — deriva "Nivel N" / "Usar
  X" / "Intercambio" del payload de `evolution-chain`, antes solo se listaban nombres).
- **Stats**: de barras a radar hexagonal real (`components/StatRadarChart`, SVG puro,
  sin librería — orden y ángulos fijos para que coincida visualmente: HP arriba,
  sentido horario) + total.
- **Habilidades/Movimientos**: de una línea con nombre a cards con datos reales del
  payload ya cacheado (`a.payload`/`m.payload`, sin llamada nueva) — habilidad con
  efecto corto en español (fallback inglés) y tag "Oculta"; movimiento con
  Pot./PP/Prec./clase de daño + `TypeBadge`.
- **Info (pestaña nueva)**: Exp. Base, barra de género (male/female desde
  `species.gender_rate`, en octavos), barra de captura, Felicidad Base, Grupo Huevo,
  Crecimiento, Hábitat, Pasos Eclosión (fórmula `(hatch_counter+1)*255` — verificada
  contra el `~5355` de Bulbasaur en la captura, coincide exacto). Todo ya estaba en
  `species`, cacheado, sin backend nuevo.

**Pendiente (no en este incremento):** pestañas Tipos (necesita el recurso `type`, ver
punto 9 de arquitectura), Ubicaciones (necesita `pokemon/{id}/encounters`, no
resuelto por el ensamblador) y Sprites (selector de variante — factible con lo que ya
hay, simplemente no se ha hecho todavía). Verificado por curl que `species` trae todos
los campos usados (`capture_rate`, `gender_rate`, `egg_groups`, `growth_rate`,
`habitat`, `generation`, `genera`, `flavor_text_entries`) y que compila sin errores —
**no verificado a ojo en navegador**, mismo hueco de `claude-in-chrome` de toda la
sesión.

## Rediseño visual completo de la UI — HECHO 2026-08-16

David pidió usar los plugins `frontend-design`/`superdesign` (recién instalados, requerían
reiniciar sesión para aparecer — ya disponibles) para rediseñar la app entera a "algo
súper guay". Se siguió el proceso de `frontend-design`: brainstorm de tokens → crítica
frente al brief → implementación. Se descartó deliberadamente evitar los 3 looks
genéricos de IA que la skill señala como sobreusados (crema+serif+terracota,
negro+neón verde/bermellón, broadsheet radius-0).

**Concepto elegido: "terminal de escaneo Pokédex"** — justificado por el propio dominio
(la app es literalmente un Pokédex/escáner), no un estilo arbitrario:
- **Color**: chasis gris-grafito (`--chassis-950/900/800`, no negro puro) +
  `--signal` ámbar `#ffb238` (dark) / `#b8630a` (light) como "LED de encendido" fijo
  (focus, CTAs, activos) — deliberadamente ni verde-neón ni bermellón para no caer en
  el cliché de "negro + acento neón único". Los colores oficiales por tipo
  (`TYPE_COLORS`, sin tocar) siguen siendo el acento dinámico por Pokémon.
- **Tipografía** (Google Fonts vía `<link>` en `index.html`, sin fuentes locales): *Chakra
  Petch* (display técnico, títulos/nombre de Pokémon), *IBM Plex Sans* (cuerpo),
  *IBM Plex Mono* (números de Pokédex, stats, badges, valores — refuerza la idea de
  "lectura de instrumento").
- **Firma visual única**: `.hud-frame` en `index.css` — marco de esquinas tipo
  visor/HUD hecho con 8 gradientes CSS puros (sin marcado extra), tintado por
  `currentColor`/`style={{color}}` desde el JSX. Solo se usa en dos sitios (a propósito,
  para no saturar): siempre visible + animado (`hud-frame--animated`) alrededor del
  sprite de cabecera en `PokemonFichaPage` (`.scanChamber`), y oculto por defecto,
  revelado al hover/focus (`hud-frame--hover`) en el sprite de `PokemonCard` de la
  lista — combinador `.card:hover :global(.hud-frame--hover)::before` en el módulo CSS.

Tocados: `index.html` (fuentes), `index.css` (tokens, utilidades globales `.eyebrow` y
`.hud-frame*`, fondo con grid sutil + focus-visible + `::selection`), `App.jsx`/`.module.css`
(nav como tira de botones de dispositivo, wordmark con LED parpadeante), y las 4
páginas + `PokemonCard`/`TypeBadge`/`StatusRow` (chips/badges reskineados a mono,
barras de progreso/género/captura como tiras LED segmentadas, radar de stats con
`filter: drop-shadow` a color de tipo). **No se tocó lógica** (hooks, ensamblador,
endpoints) — solo JSX estructural mínimo (wrappers para el marco HUD, eyebrows) y CSS.

**Verificado:** Vite compila sin errores (`docker compose logs frontend`, tras corregir
un `<div>` sin cerrar en `StatusPage.jsx` detectado por el propio error de Vite), las 4
rutas (`/`, `/cache`, `/pokemon`, `/ficha/25`) devuelven 200 sin "Internal Server
Error". **No verificado a ojo en navegador** — se intentó `claude-in-chrome` de nuevo
en esta sesión (tras la skill sí cargar esta vez) y el mensaje fue "extensión no
conectada en esta sesión", igual que las veces anteriores; no hay Chromium/Puppeteer
disponible en el host tampoco para capturar screenshot por otra vía. David debe revisar
`http://localhost:5174` a ojo y dar feedback — sigue siendo el mismo hueco de
verificación visual de toda la vida de este proyecto.

**Pendiente de este rediseño:** `.evoList`/`.evoConnector` y el resto de paneles no se
probaron con datos reales variados (p.ej. Eevee con evolución ramificada, ya sabido no
soportado por `flattenEvolutionChain`, ver sección anterior) — solo se comprobó que
compila. Si el look no convence a David en algún punto concreto, iterar sobre ese
archivo puntual en vez de replantear el sistema de tokens entero.

## Lista de Pokémon: paginada por generación + filtros — HECHO 2026-08-16

David pidió que `/pokemon` fuera lazy y paginada por generaciones, con búsqueda por
nombre/tipo1/tipo2/mega/gigamax/regional/legendario/singular/nº de etapas evolutivas
(1-3). Se clonó `Dexter` (Android, solo lectura) a scratchpad para ver
`GenerationPagerScreen`/`MenuBusqueda.kt`: confirmó que el Android solo filtra por
nombre+tipo1+tipo2 (nada de mega/gigamax/regional/legendario/singular/etapas — esos
filtros son nuevos, no existían ya resueltos ahí) y que "paginar por generación" en
Android es literalmente un pager que carga+cachea por generación. **"Singular" es el
término oficial en español para "Mythical Pokémon"** (`species.is_mythical`) — mismo
patrón que "Legendario" = `is_legendary`.

**Backend** — todo derivado de caché ya existente, sin llamadas nuevas a PokeAPI:
- `PokeApiResourceCacheRepository::findSpeciesSummaries()`: por cada fila
  `pokemon-species` cacheada, `JSON_EXTRACT` saca `generation.url` (→ id 1-9),
  `is_legendary`, `is_mythical`, `varieties` (→ `hasMega`/`hasGmax`/`hasRegional` por
  substring del slug: `-mega`, `-gmax`, `-alola`/`-galar`/`-hisui`/`-paldea`) y
  `evolution_chain.url`. Sin hidratar el payload completo (mismo cuidado de memoria de
  siempre).
- `findEvolutionChainDepths()`: para `evolution-chain` (solo ~540 filas, payloads
  pequeños a diferencia de `pokemon-species`) sí decodifica el payload completo y
  calcula la profundidad recursiva de `chain.evolves_to` (rama más larga) → nº de
  etapas. **Limitación conocida:** de las 541 cadenas solo 3 están cacheadas ahora
  mismo (mismo hueco que siempre — la mayoría de fichas no se han visitado/cacheado
  individualmente); para el resto `evolutionStages` sale `null` y ese Pokémon
  simplemente no coincide con ningún filtro de etapas hasta que se cachee
  `evolution-chain` en bloque desde `/cache`. David avisado de esto.
- `PokemonListService::listAll()` fusiona todo lo anterior en cada entrada de
  `GET /api/pokemon`: añade `generation`, `legendary`, `mythical`, `hasMega`,
  `hasGmax`, `hasRegional`, `evolutionStages` a lo que ya devolvía (`id`, `name`,
  `types`, `cached`, `fetchedAt`). Verificado por curl: Bulbasaur `evolutionStages:3`,
  Charizard `hasMega:true, hasGmax:true`, Eevee `hasGmax:true` (por Eevee-Gmax).

**Frontend** — `usePokemonBrowser` (hook nuevo, estado de filtros + generación activa
+ derivación memoizada): si hay algún filtro/búsqueda activo se muestra una lista
plana con TODOS los resultados (cruzando todas las generaciones); si no, se muestra
solo la generación activa — mismo patrón que el pager de Android (que cambia a lista
plana bajo filtro). Esto es lo que hace la vista "lazy": nunca se montan los ~1025
`PokemonCard` a la vez, salvo que un filtro muy amplio lo produzca. `PokemonCard`
también gana `loading="lazy" decoding="async"` en el `<img>` como capa extra.
Componentes nuevos `GenerationPager` (pestañas número romano + región en español,
ej. "V Teselia" — `utils/generations.js`) y `PokemonFilters` (input nombre, 2
selects de tipo, chips toggle para legendario/singular/mega/gigamax/regional, selector
1/2/3 de etapas, contador de resultados y botón limpiar). `PokemonListPage` queda
como composición pura de estos + el hook, sin lógica propia (cumple decisión 7).

**Verificado:** backend por curl (`generation`/`legendary`/`hasMega`/etc. correctos
contra Bulbasaur/Charizard/Eevee), frontend compila sin errores en las 4 rutas
(comprobado también pidiendo directamente los módulos nuevos a Vite, sin
`PARSE_ERROR`/`Failed to resolve`). **No verificado a ojo en navegador** — mismo hueco
de `claude-in-chrome` de siempre, no conectado en esta sesión tampoco.

**Pendiente:** el filtro de etapas evolutivas es poco útil hasta que se cachee más
`evolution-chain` en bloque; no hay debounce en el input de búsqueda (con 1025 items
en memoria el filtrado es barato, no debería notarse, pero si se nota lento añadir
`useDeferredValue` o debounce al `query`).

## Ajuste de la ficha para desktop + quitar fondo de cuadrícula — HECHO 2026-08-16

David compartió 9 capturas nuevas de Dexter (`/home/david/Escritorio/capturas/`, ficha
de Bulbasaur — mismo set de referencia visual que el rediseño del 16-08 pero pidiendo
imitarlo de nuevo) con dos quejas concretas sobre lo que se acababa de construir con
`frontend-design` (ver sección "Rediseño visual completo de la UI" arriba): **(1)** la
ficha desaprovecha mucho espacio horizontal en desktop (las capturas son de móvil, una
sola columna — David es consciente y aun así señala que en escritorio eso deja los
lados vacíos), **(2)** el fondo de cuadrícula (`body { background-image: grid... }` en
`index.css`) "no mola nada".

**No se descartó el sistema de tokens** (ámbar/chasis-grafito/Chakra Petch+IBM Plex,
marco HUD) montado en la sesión anterior — David no pidió tirarlo, solo señaló estos
dos problemas concretos + "imita las capturas". Se interpretó como: adoptar el
lenguaje visual redondeado/con sombra suave de Dexter (tarjetas con esquinas grandes,
pills de tipo, layout de la cabecera con banda dual por tipo — esto último YA
coincidía con lo que había) pero resuelto para desktop, no un cambio de paleta.

- `index.css`: eliminado el `background-image` de rejilla de `body` — solo queda el
  resplandor radial ámbar sutil ya existente (opacidad bajada de 10% a 7%).
- `PokemonFichaPage`: layout reestructurado a grid de 2 columnas
  (`.layout { grid-template-columns: 340px 1fr }`, `max-width` de la página subido de
  720px a 1280px). Columna izquierda = tarjeta hero (`position: sticky; top: 5.5rem`,
  ahora con `border-radius: 1.25rem` + sombra suave en vez de banner de ancho
  completo). Columna derecha = pestañas + contenido. El aviso de "faltan recursos por
  cachear" se subió fuera del grid, a todo el ancho, arriba del todo. Colapsa a una
  columna con `@media (max-width: 900px)` (hero deja de ser sticky).
- Paneles de contenido reescritos para usar el ancho ganado en vez de apilar en una
  columna estrecha: `.cardList` (Habilidades/Movimientos/Formas) pasa de flex-column a
  `grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))`; `.infoList` (pestaña
  Info) a `repeat(auto-fit, minmax(280px, 1fr))` (2 columnas en desktop); `.evoList`
  pasa de tarjetas apiladas verticalmente a flujo horizontal con conector de línea
  discontinua entre ellas (antes vertical). `.quote` (Descripción) con
  `max-width: 60ch` para no perder legibilidad en líneas demasiado largas. Cards con
  sombra suave (`box-shadow`) añadida, coherente con el look de las capturas.
- El marco HUD de esquinas (firma visual, ver rediseño anterior) se mantuvo alrededor
  del sprite de cabecera — no entra en conflicto con el redondeado, es análogo a las
  marcas de visor de una cámara sobre una foto con esquinas redondeadas.

**No tocado:** nav, `/`, `/cache`, `/pokemon` — David solo señaló la ficha y el fondo
global; el resto del sistema de tokens/paleta sigue igual. Si en algún momento pide
"que todo se parezca más a las capturas" habría que revisar si quiere también el
cream/beige de fondo de Dexter en vez del chasis oscuro — de momento no lo ha pedido.

**Verificado:** compila sin errores (`docker compose logs frontend`, y se pidió
directamente el módulo transformado de `PokemonFichaPage.jsx` a Vite para confirmar
que no quedaba ningún `PARSE_ERROR` residual de un estado intermedio del edit). **No
verificado a ojo en navegador** — mismo hueco de `claude-in-chrome` de toda la vida de
este proyecto.

## Cacheo por lotes concurrente — HECHO 2026-08-16

David preguntó si el cacheo lento era limitación real de PokeAPI o mejorable. No era
la PokeAPI: era que `cacheAllPending` (compartida por el botón por-recurso y el botón
maestro de `/cache`) hacía **un POST por item, en serie**, esperando la respuesta
completa (ida y vuelta navegador↔backend↔PokeAPI↔BD con `flush()` individual) antes de
lanzar el siguiente. David pidió arreglarlo pero dejó claro: **sigue siendo 100%
manual** — nada de cacheo en segundo plano ni disparado automáticamente, solo que el
botón que ya existía vaya más rápido.

- `PokeApiClient::fetchManyResources(resourceType, ids[])` — dispara todas las
  peticiones a PokeAPI con `request()` (no bloquea hasta `toArray()`) antes de leer
  ninguna respuesta, así que el `HttpClient` de Symfony las corre en paralelo por
  debajo (multiplexado por curl). `config/packages/framework.yaml` sube
  `max_host_connections` de 6 (default) a 30 para que ese paralelismo sea real.
- `PokeApiCacheService::cacheBatch(resourceType, ids[])` — pide ese lote entero de
  golpe y hace **un único `flush()`** al final (antes: un flush por item). Ids ya
  cacheados se descartan con `PokeApiResourceCacheRepository::findExistingIds()`
  (defensivo, por si la lista que tenía el frontend estaba desactualizada).
- Endpoint nuevo `POST /api/pokeapi/{resourceType}/cache-batch` (body
  `{"ids": [...]}`, máx. 100 por seguridad) — `PokeApiCacheBatchController`. El
  endpoint de un solo id (`POST .../cache/{idOrName}`) se deja igual, lo sigue usando
  el botón "cachear lo que falta" de una ficha individual (no se tocó, no hacía falta).
- Frontend: `cacheAllPending` (`utils/cachePokeApiResource.js`) trocea lo pendiente en
  lotes de 40 (`BATCH_SIZE`) y llama a `/cache-batch` en vez de un POST por id;
  `useCacheAllResource` ahora suma `done` por lote en vez de por item. Mismos botones
  de siempre, mismo disparo manual — solo cambió cómo cachea por dentro.

**Medido en real** (`location-area`, todos sus 1533 ids estaban pendientes): 40 ids en
lote → 1.52s; el endpoint antiguo de un id → ~0.6-0.8s cada uno. **~17-20x más
rápido.** Se probó a fondo cacheando `evolution-chain` completo (291 ids pendientes,
8s en total) — de paso esto deja resuelta la limitación pendiente del filtro de
"etapas evolutivas" de `/pokemon` (antes solo 3/541 cadenas cacheadas y la mayoría de
Pokémon con `evolutionStages: null`; ahora 541/541 cadenas cacheadas y **1025/1025
Pokémon con `evolutionStages` calculado**, verificado por curl).

**Verificado:** backend probado por curl end-to-end (lote real de 40 `location-area` +
291 `evolution-chain`, conteos de cacheados coinciden exactamente con lo esperado),
frontend compila sin errores. **No verificado a ojo en navegador** (mismo hueco de
`claude-in-chrome` de siempre) — el flujo real del botón "Cachear todo" en `/cache`
no se ha pulsado a través de la UI en esta sesión, solo su lógica equivalente por curl.

## Selector de idioma de los datos (ES/EN) — HECHO 2026-08-16, ampliado a la interfaz 2026-08-17

David notó que muchas cosas aparecían en inglés (nombres de movimientos, habilidades,
formas, algunos Pokémon) y pidió poder cambiar el idioma. **Alcance deliberadamente
acotado en su momento**: solo el idioma de los DATOS de PokeAPI, no de la interfaz.
**Superado 2026-08-17**: David pidió explícitamente que la interfaz también cambie de
idioma — ver sección "i18n de la interfaz" más abajo. `LanguageContext` sigue siendo
la única fuente de verdad del idioma (persistido en localStorage); ahora también
gobierna react-i18next, no solo la localización de datos de PokeAPI.

**Punto clave que simplificó todo:** los payloads ya cacheados traen el nombre en
*todos* los idiomas dentro de `names[]`/`genera[]`/`flavor_text_entries[]` (así
responde PokeAPI siempre) — no hizo falta cachear nada nuevo ni tocar
`PokeApiCacheService`, es un cambio casi entero de frontend. Verificado con curl que
21 especies difieren de verdad entre es/en (Código Cero/Type: Null, los 10 Pokémon
Paradoja de Escarlata/Púrpura...) y que moves/abilities también traen `names[]`
completo (ej. `mega-punch` → "Megapuño"/"Mega Punch").

- `contexts/LanguageContext.jsx`: `LANGUAGES` (`[{code:'es'},{code:'en'}]`),
  `LanguageProvider` + `useLanguage()`, persistido en `localStorage`
  (`pokewebmax:language`). Envuelve `<App/>` en `main.jsx`. Selector en el nav
  (`App.jsx`), pastillas ES/EN junto a los enlaces.
- `utils/pokeApiLocalization.js`: `localizedEntry(entries, language, textKey)` /
  `localizedName(payload, language, fallback)` — genérico para cualquier array
  `[{<textKey>}, language:{name}]` de PokeAPI, con fallback a inglés y luego al
  primer idioma disponible antes que dejar un hueco vacío.
- `utils/pokemonFicha.js`: `spanishGenus`/`spanishFlavorTextsByVersion` (hardcodeados
  a 'es') pasan a `genusForLanguage(species, language)` /
  `flavorTextsByVersion(species, language)`; nuevas `speciesDisplayName(species,
  language, fallback)` y `damageClassName(slug, language)` (physical/special/status,
  solo 3 valores, hardcodeado a mano — no merece cachear `move-damage-class` solo
  para esto).
- `utils/pokemonTypes.js`: `typeNameEs` → `typeName(type, language)` — para 'es' usa
  la tabla `TYPE_NAMES_ES` ya existente, para cualquier otro idioma capitaliza el
  slug (que YA es el nombre en inglés, `fire`→`Fire`) en vez de mantener una tabla
  traducida por cada uno de los 18 tipos en cada idioma.
- Ficha (`PokemonFichaPage.jsx`): nombre del Pokémon, genus, descripción, nombres de
  movimiento/habilidad/forma y clase de daño ahora pasan por estas funciones con
  `language` del contexto. El efecto de habilidad (`short_effect`) también.
- **Backend nuevo, solo para lo que la ficha/lista no cargan completo:**
  `GET /api/pokemon/names` (`PokemonNamesController` → `PokemonListService::
  namesById()` → `PokeApiResourceCacheRepository::findSpeciesLocalizedNames()`,
  JSON_EXTRACT de `$.names` filtrado a los idiomas soportados — mismo patrón de
  proyección ligera que el resto del repo, sin hidratar payload). Usado por
  `hooks/usePokemonNames.js` en dos sitios que no tienen la especie completa cargada:
  la lista de Pokémon (`PokemonListPage`/`PokemonCard`, prop `displayName` nueva) y
  los nombres de cada etapa en la pestaña EVOS de la ficha (que solo tiene
  id+slug desde el payload de `evolution-chain`, no la especie de cada etapa). El
  Pokémon *actual* de la ficha se localiza directo desde su propia `species.names`
  ya cargada, sin pasar por este endpoint.
- `hooks/usePokemonBrowser.js`: la búsqueda por nombre ahora compara también contra
  el nombre localizado (`names[id]?.[language]`), no solo el slug en inglés — para
  poder buscar "Código Cero" y no solo "type-null".

**Cómo añadir un idioma nuevo:** añadir `{code, label}` a `LANGUAGES` en
`LanguageContext.jsx` (frontend) + al array `SUPPORTED_LANGUAGES` de
`PokemonListService` (backend, para que `/api/pokemon/names` lo incluya) — el resto
(`localizedEntry`, `genusForLanguage`, etc.) ya es genérico por idioma, no hay que
tocarlo. `typeName()`/`damageClassName()` seguirán cayendo al inglés para cualquier
idioma que no sea 'es' hasta que se les añada su propia rama si se quiere traducción
real ahí también.

**No traducido todavía (gap conocido, deliberado por riesgo/coste):** grupo huevo,
hábitat, tasa de crecimiento y nombres de versión de juego en la pestaña INFO/DESC
siguen mostrando el slug de PokeAPI capitalizado (en inglés) en cualquier idioma,
incluido español — requeriría o bien cachear+resolver esos recursos aparte
(`growth-rate`, `pokemon-habitat`, `egg-group`, `version`) en el ensamblador, o
hardcodear tablas de traducción que no se quiso arriesgar a equivocar de memoria
(a diferencia de `damage-class`, que solo tiene 3 valores bien conocidos). Si se pide
completar esto, el camino correcto es que `PokemonFichaAssembler` resuelva esos
recursos desde la caché igual que ya hace con species/moves/abilities/forms.

**Verificado:** compila sin errores en las 5 rutas (incluidos los módulos nuevos
pedidos directamente a Vite), `GET /api/pokemon/names` devuelve 1025 entradas con
es/en correctos, `GET /api/pokemon/772/ficha` confirma que `species.names`/`genera`
traen es/en distintos de verdad. **No verificado a ojo en navegador** (clicar el
selector ES/EN y comprobar visualmente) — mismo hueco de `claude-in-chrome` de
siempre.

## Fallback de descripción por versión, no global — HECHO 2026-08-16

David notó que faltaban muchos juegos en el selector de descripción. Diagnosticado con
curl contra datos reales: **es limitación real de PokeAPI, no bug nuestro** — Bulbasaur
tiene 28 entradas de flavor text en inglés (Rojo→Escudo) pero solo 8 en español
(empieza en X/Y, nada de Gen 1-5; probablemente sistémico en toda la especie, el
español se añadió mucho más tarde a PokeAPI). Sí se pudo mejorar la UX: el fallback a
inglés de `flavorTextsByVersion` (`utils/pokemonFicha.js`) era global (si el idioma
pedido tenía CERO entradas, todo caía a inglés) — se cambió a **fallback por versión**:
cada juego usa español si existe, y si no, cae a inglés solo para ESE juego (marcado
`translated: false`), en vez de que el juego entero desaparezca del selector. Verificado
simulando el algoritmo contra el payload real de Bulbasaur: pasa de 8 a 14 chips.

Frontend: chip de versión con etiqueta "EN" pequeña cuando `translated: false`
(`styles.tag`, reusado con `margin-left` propio vía `.versionChip .tag`), y una nota
bajo la cita ("Sin traducción de PokeAPI para este idioma en este juego") cuando la
versión activa no está traducida. Cuando el idioma seleccionado ES inglés, nunca se
marca nada (siempre `translated: true` en ese caso).

## WikiDex: dump local ya obtenido por David + análisis hecho — CONTINÚA la siguiente sesión

David quería el fallback que hace Dexter (Android) cuando PokeAPI no tiene la
descripción en español de un juego (ver sección anterior — hueco mitigado a medias
con el fallback por-versión a inglés). Doc de referencia:
`docs/reference-android/wikidex-scraping-system.md`. **La preocupación de la sesión
anterior sobre el `robots.txt` de WikiDex bloqueando `ClaudeBot` ya NO aplica**: David
descargó él mismo, con su propio script `scripts/dump_wikidex.py` (API oficial de
MediaWiki, no scraping de HTML), un dump completo de WikiDex a
`scripts/wikidex_dump/` (sin commitear). Integrar esto es una importación **offline**
desde disco local, sin peticiones en vivo a wikidex.net — la línea de "quién obtiene
el dato" (ver sección de sprites HOME/animados) queda respetada igual que con los
sprites: David lo obtuvo, Claude solo lee/usa lo que ya hay en disco.

**Claude ya examinó el dump a fondo (misma sesión 2026-08-16) y dejó un plan de
integración concreto y accionable — ver
[[project_pokewebmax_wikidex_dump_analysis]] antes de tocar nada de esto.** Resumen
ultra-corto: el `title` de cada página de WikiDex coincide exacto con
`species.names[es]` de PokeAPI (join sin mapeo manual), cada especie tiene un bloque
`{{Pokédex}}` en wikitext con una entrada por juego (cubre justo Gen I-V/BDSP/Legends
Arceus/Scarlet-Violet/Legends Z-A, el hueco real de PokeAPI-ES) más un bloque
`{{Localización}}` con el mismo patrón, útil para la pestaña Ubicaciones pendiente.
Falta escribir el parser de wikitext + una entidad Doctrine nueva (no la tabla
genérica de PokeAPI) + comando de importación offline — todo el detalle técnico
(claves de juego, alias, subplantillas, casos raros) está en esa nota, no hace falta
re-abrir el dump de 446MB para recordarlo.

## WikiDex: integración completa — HECHO 2026-08-17

Los 5 pasos del plan de la sesión anterior, hechos y verificados con datos reales (ver
[[project_pokewebmax_wikidex_dump_analysis]] para el detalle técnico completo de cada
uno — parser wikitext, tabla de mapeo a `version` de PokeAPI, entidad
`WikidexFlavorText` + migración, comando `app:wikidex:import`, y el tercer nivel de
`flavorTextsByVersion()`). BD local ya poblada: 16.943 filas en `wikidex_flavor_text`
(1025/1025 especies cacheadas cruzadas). Reimportar tras regenerar el dump: `bash
scripts/import_wikidex.sh`.

Verificado con el módulo JS real (no reimplementado) contra la ficha real de
Bulbasaur: `red/yellow/gold/silver/crystal/ruby/firered/diamond` pasan de mostrarse
en inglés a español, y `leafgreen` aparece en el selector por primera vez. No
verificado a ojo en navegador (sin `claude-in-chrome` disponible esta sesión) — mismo
hueco de siempre, ver nota de arriba sobre el selector ES/EN.

**No pedido todavía, posible trabajo futuro:** las 56 formas regionales de WikiDex sin
especie propia en PokeAPI (Raichu de Alola, Corsola de Galar...) se quedan sin
fallback — limitación del modelo de datos (PokeAPI no tiene flavor text por forma), no
un bug. Y la pestaña Ubicaciones con `{{Localización}}`: el parser ya lo soporta
(`parse_localizacion()`), pero falta todo el cableado de exportación/entidad/import/
frontend — mismo patrón que este documento, sin empezar.

## Descripciones de habilidades/movimientos en español + i18n de la interfaz — HECHO 2026-08-17

Tres pedidos en la misma sesión, todos ejecutados:

**1. Descripción de habilidades en español.** Diagnosticado con SQL directo contra la
caché real: `effect_entries` (lo que se usaba) no tiene NINGUNA entrada en español en
toda la caché — 0/373 abilities, 0/937 moves, limitación real de PokeAPI, no bug
nuestro. Pero SÍ existe `flavor_text_entries` (mismo texto corto, por versión de
juego) con cobertura real: 267/373 abilities, 826/937 moves en español. Cambiado el
origen del texto a `flavor_text_entries`, sin tocar el backend (el payload completo ya
estaba cacheado, incluye ese campo). Nueva función `latestVersionedText(entries,
language, textKey)` en `utils/pokemonFicha.js` — coge la ÚLTIMA entrada que matchea
(no la primera como `localizedEntry`) porque el array es cronológico y el texto cambia
de redacción entre generaciones. Devuelve `{text, translated}`, mismo patrón de tag
"EN" que ya usaba el selector de descripción de especie.

**2. Movimientos desplegables con descripción.** Las cards de `MOVES` en
`PokemonFichaPage.jsx` ahora son clicables (`role="button"`, con soporte de teclado
Enter/Espacio) — al hacer click alternan un estado `expandedMoves` (Set de ids) que
muestra `latestVersionedText(move.flavor_text_entries, language)` bajo las stats.
100% frontend, el payload del movimiento ya venía completo desde el backend.

**3. i18n completo de la interfaz.** David pidió expandir el selector ES/EN — antes
solo tocaba datos de PokeAPI, la interfaz se quedaba fija en español (ver nota de
arriba). **Decisión de librería consultada a David explícitamente** (no decidida por
Claude): eligió `react-i18next` sobre un diccionario propio, a pesar de que el caso de
uso (2 idiomas fijos, ~80 strings) hubiera bastado con algo más ligero — es su
preferencia explícita para dejarlo mejor preparado a futuro (más idiomas, plurales).
  - `frontend/src/i18n.js` + `locales/{es,en}.json` (82 claves, mismas en ambos
    idiomas, verificado). `LanguageContext` sigue siendo la fuente de verdad del
    idioma — llama a `i18next.changeLanguage()` al cambiar y también durante el
    render inicial (no en un efecto) para no parpadear en español si hay 'en'
    persistido en localStorage.
  - **Criterio de qué va por i18next y qué no** (documentado en `i18n.js`): prosa de
    interfaz con interpolación (botones, mensajes, plurales) va en
    `locales/*.json` vía `useTranslation()`. Catálogos internos indexados por clave
    (pestañas de la ficha en `FICHA_SECTIONS`, las 49 etiquetas de recursos de
    PokeAPI en `pokeApiResources.js`, nombres de región en `generations.js`) se
    quedan como objetos bilingües inline `{es, en}` — mismo patrón que ya usaba
    `DAMAGE_CLASS_ES` antes de esta sesión. Mezclar los dos mecanismos fue deliberado,
    no inconsistencia: son tipos de contenido genuinamente distintos.
  - Los mensajes de error que vienen del backend (`err.response?.data?.error`) NO se
    traducen — el backend no tiene i18n y traducirlo no se pidió; el fallback local
    ('Error inesperado.' → `errors.unexpected`) sí usa el `i18n.t()` global (fuera de
    componente, hooks como `usePokemonFicha`/`usePokemonList` lo importan
    directamente de `i18n.js`, no de `useTranslation()`).
  - `useServiceHealth.js` refactorizado para devolver solo estados (`ok`/`error`/
    `pending`/`unknown`), no texto ya traducido — si no, cambiar de idioma a media
    sesión dejaría frases viejas en pantalla hasta el siguiente fetch.
  - **Verificado con datos reales**: `npm run build` (vía `node
    node_modules/vite/bin/vite.js build` — el mismo problema de fuseblk/sin bit +x de
    siempre) compiló limpio, 167 módulos. Interpolación y pluralización de i18next
    probadas con `i18next.t()` real (no reimplementado) para ambos idiomas.
    **No verificado a ojo en navegador** (sin `claude-in-chrome` disponible esta
    sesión) — clicar el selector ES/EN y comprobar que todo el nav/botones/mensajes
    cambian de verdad sigue pendiente de que David lo mire una vez.

## Seis retoques de UX del frontend — HECHO 2026-08-17

David dio una lista de 6 quejas concretas tras usar la app un rato. Todas resueltas
en la misma sesión (commit+push de la sesión anterior ya hecho antes de empezar):

1. **Home = lista de Pokémon, no Estado.** Rutas re-mapeadas en `App.jsx`: `/` ahora es
   `PokemonListPage`, `StatusPage` se movió a `/status`. Nav reordenado: Pokémon,
   Cachear, Estado.
2. **Ordenación en la lista** (antes no existía ninguna, solo filtros). Nueva
   constante `SORTS` en `hooks/usePokemonBrowser.js` (número/nombre/tipo/altura/peso/
   facilidad de captura/total de stats) + toggle asc/desc. Requirió backend nuevo:
   `PokeApiResourceCacheRepository::findPokemonListMetricsById()` (peso/altura/suma de
   stats desde el payload `pokemon` cacheado) y `capture_rate` añadido a
   `findSpeciesSummaries()` — `PokemonListService::listAll()` los expone. Verificado
   con datos reales: peso ordena Gastly/Kartana primero (los más ligeros reales),
   captura ordena legendarios primero (tasa 3, la más baja real).
3. **Interfaz más grande / letras más visibles.** `index.css`: `font: 16px` → `18px`
   en `:root`. Casi todo el sizing de la app está en `rem`, así que esto escala
   interfaz y texto a la vez sin tocar cada regla suelta.
4. **Navegación ficha→lista.** No existía ningún control en la app para volver — había
   que usar el botón atrás del navegador. Añadido `<Link to="/">` ("← Pokémon") arriba
   de `PokemonFichaPage`.
5. **Espacio desaprovechado en la ficha.** `.page` max-width 1280px → 1520px, `.quote`
   (descripción) 60ch → 85ch. El cambio real: la pestaña STATS solo mostraba el radar
   centrado con mucho hueco vacío alrededor — ahora va acompañado de una lista de
   barras por stat (`.statBars`, reusa `STAT_ORDER`/`STAT_LABELS` ahora exportados de
   `StatRadarChart.jsx`) en vez de agrandar nada.
6. **La lista se recargaba entera cada vez que volvías de una ficha.** Nueva caché en
   memoria fuera de React, `utils/pokemonListCache.js` (`getCachedPokemon`/
   `setCachedPokemon`/`invalidatePokemonCache`) — `usePokemonList` la usa como estado
   inicial y solo hace fetch si está vacía; el botón "Recargar" la sigue forzando
   igual. Invalidada explícitamente cuando algo puede haber cambiado lo que se ve en
   la lista: cachear `pokemon`/`pokemon-species` desde `/cache` (por recurso o
   "cachear todo"), o `cacheMissing` desde la propia ficha.

**Verificado:** `vite build` de producción compiló limpio (168 módulos) tras todos los
cambios. Ordenación probada contra `/api/pokemon` real (1025 especies cacheadas), no
simulada. **No verificado a ojo en navegador** — sin `claude-in-chrome` disponible
esta sesión tampoco; David debería darle un vistazo al layout de STATS y al tamaño de
letra antes de darlo por definitivo, son los dos cambios más "de gusto" del lote.

## Versiones "desaparecidas" del selector de descripción — HECHO 2026-08-17

David notó que "Blue" no aparecía como opción en el selector de descripción de la
ficha y preguntó si era un fallo de diseño. Lo era, aunque intencional: la sesión que
implementó el fallback por-versión (ver más arriba) colapsaba texto idéntico entre
versiones a UNA sola entrada quedándose con la primera y **descartando el resto en
silencio** — Rojo/Azul comparten la misma redacción en PokeAPI, así que "Azul" se
perdía sin ningún indicio. Verificado con Bulbasaur: solo 12 de las 28 versiones
reales sobrevivían al collapse (diamante/perla/platino/negro/blanco/negro-2/blanco-2/Y
compartían texto y colapsaban a un único "Diamante").

**Primer arreglo (agrupar en una pastilla con contador `+N` y tooltip) descartado por
David tras verlo explicado**: "no importa que haya descripciones idénticas (si
realmente en los juegos eran idénticas)" — prefiere transparencia total sobre
compacidad. **Decisión final**: `flavorTextsByVersion()` en `utils/pokemonFicha.js`
ya NO colapsa ni agrupa nada — cada versión real es su propia pastilla del selector,
aunque el texto sea idéntico al de otra. Vuelve a devolver `{version: string, text,
translated}` (singular, como antes de la sesión), no `{versions: string[]}`.
Verificado con datos reales: Bulbasaur muestra sus 28 versiones reales como 28
pastillas independientes, "Azul" incluida.

## Iconos/carátulas de Pokedex_API + rediseño de la ficha (sin pestañas) — HECHO 2026-08-17

**Recursos copiados de Pokedex_API** (`/media/david/BIG_DATA/Docu/WORKSPACE/Pokedex_API/app/src/main/res/drawable/` —
proyecto Android de referencia, **solo lectura, no se toca nada ahí**, ver CLAUDE.md):
- `fisico.png`/`especial.png`/`estado.png` → `frontend/src/assets/damage-classes/
  {physical,special,status}.png`. Usados en la card de movimiento (icono junto al
  texto de la clase de daño), vía `damageClassIconUrl()` en `utils/pokemonFicha.js`.
- 38 carátulas `game_*.{webp,jpg,png}` → `frontend/src/assets/games/<version-slug>.*`
  (mapeadas a mano a los slugs `version` de PokeAPI). **Redimensionadas de 2048×2048
  (~800KB) a máx. 220×220 con ImageMagick** antes de copiar al repo — se muestran a
  44px, no tenía sentido cargar el original; 4,6MB → 720KB en total.
  `utils/gameCovers.js` las resuelve con `import.meta.glob` (extensión mixta, no vale
  un import estático por archivo) → `gameCoverUrl(versionSlug)`, `null` si no hay
  carátula (DLC/exclusivas de Japón que Pokedex_API no tenía, ej. colosseum). El
  selector de descripción usa la carátula en vez del nombre en texto cuando existe.

**Rediseño de la ficha** (David señaló, con captura, que el sprite se veía pequeño y
sobraba muchísimo espacio vacío bajo las pestañas — confirmado en la captura: la
pestaña Descripción activa dejaba más de media pantalla vacía). Propuesta discutida y
aprobada por David ("cabe todo en la misma vista, sin pestañas, y con anclas, sí"):
- Las 7 secciones (`FICHA_SECTIONS`) se renderizan SIEMPRE, apiladas, ya no hay
  `{section === 'X' && (...)}` ocultando el resto. Cada una es un `<section>` con
  `<h2>` propio y `scroll-margin-top` (offset combinado de las dos barras fijas).
- La barra de "pestañas" pasó a ser una barra de anclas: `onClick` hace
  `scrollIntoView` en vez de mostrar/ocultar, y se quedó `position: sticky` justo
  debajo del nav de la app para poder saltar de sección sin subir del todo.
  **Scrollspy con `IntersectionObserver`** (banda de activación bajo las dos barras
  fijas hasta el 70% superior del viewport) resalta sola la pestaña de la sección que
  se está viendo al hacer scroll, no solo al hacer click.
- Sprite/animación agrandado (`heroBands` 16rem→22rem, `scanChamber` 12rem→17rem) y
  columna del hero ensanchada (340px→380px) — ahora que el contenido de al lado ya no
  está artificialmente acotado a una sola pestaña corta, no hay problema en que el
  hero ocupe más.
- **Responsive de verdad, sí implementado**: en móvil (≤900px, mismo breakpoint que ya
  partía `.layout` a una columna) se mantiene el comportamiento de mostrar-solo-la-
  sección-activa — clase `.sectionInactiveMobile` (`display:none` solo bajo ese
  breakpoint) en las 6 secciones no activas, más `scrollToSection()` con
  `window.matchMedia('(min-width: 901px)')` para no disparar el scroll-to-ancla en
  móvil (ahí no hace falta, solo cambia qué sección está visible). Razonamiento de
  David en su mensaje original de que los tabs sí tienen sentido en móvil, aplicado
  literalmente.

**Verificado:** `vite build` de producción compila limpio tras cada paso (glob de
carátulas incluido, 38 imágenes bundleadas correctamente), estructura de las 7
`<section>` balanceada (8 aperturas/8 cierres contando el `<section>` raíz de la
página), keys de `FICHA_SECTIONS` coinciden 1:1 con las refs del scrollspy. **No
verificado a ojo en navegador** (sin `claude-in-chrome` esta sesión tampoco) — el
scroll-to-ancla, el offset de las barras fijas y el scrollspy son la parte más
sensible a probar visualmente antes de darlo por bueno del todo.

## Diez retoques más de la ficha (tras el rediseño sin pestañas) — HECHO 2026-08-17

David dio otra lista tras probar el rediseño de la sesión anterior. La captura que
adjuntó (`a.png`) resultó ser la MISMA del mensaje anterior (Mewtwo, layout viejo, sin
Evolución visible) — no servía para diagnosticar el punto de las evoluciones
descuadradas, así que ese se resolvió leyendo el JSX/CSS directamente, no a ojo.

1. **Tabla de movimientos ordenable** (nivel/tipo/clase) — sustituye la cuadrícula de
   cards. **Decisión discutida y confirmada por David** (prefirió la tabla sobre
   forzar alturas iguales en las cards, ver [[feedback_no_silent_data_collapsing]] para
   el patrón de cómo se le consulta este tipo de decisión). Nueva
   `moveLevelLearned(pokemonMoves, moveName)` en `utils/pokemonFicha.js`: 100%
   frontend, `pokemon.moves[].version_group_details[]` ya trae `level_learned_at` +
   `move_learn_method` por version_group, no hizo falta tocar el backend. Se usa el
   version_group con el id más alto (el más reciente) con method 'level-up'; null si
   nunca se aprende por nivel (MT/cría/tutor) — ordena al final, no como si fuera 0.
   Extraído `compareValues()` a `utils/sorting.js` (antes duplicado en
   `usePokemonBrowser`, ahora compartido con la tabla de movimientos). Cabeceras
   clicables alternan asc/desc; la descripción se despliega como fila `colSpan`, no
   cambia el alto de la fila del movimiento.
2. **"Movimientos sin traducir"**: verificado con SQL directo que los 937/937 nombres
   de movimiento SÍ están en español (0 coincidencias es===en en un muestreo real de
   131 movimientos de Charizard) — no hay bug ahí. Lo que David ve es casi seguro el
   tag "EN" ya existente en la descripción (111/937 movimientos sin flavor_text en
   español en PokeAPI, límite real de los datos) — se mantiene visible en la tabla
   nueva, no se oculta (ver [[feedback_no_silent_data_collapsing]]).
3. **Secciones colapsables y animadas**: cada `<h2>` de sección es ahora un botón
   (`SectionHeading`) que colapsa/expande con el truco de
   `grid-template-rows: 1fr → 0fr` (`.collapseWrap`/`.collapseInner` en el CSS) — anima
   con contenido de alto variable sin JS ni max-height a mano. Estado
   `collapsedSections` (Set), todas expandidas por defecto.
4. **Breadcrumb sticky**: `.backLink` ahora `position: sticky` bajo el nav de la app.
5. **Carátulas más grandes**: `.versionCover` 2.75rem → 5rem (las imágenes ya vienen a
   220×220, de sobra de resolución).
6. **Evoluciones descuadradas — bug real encontrado por inspección de código** (no
   por la captura, que no la mostraba): el wrapper `<div>` de cada etapa (conector +
   card) no tenía `display:flex`, así que conector y card se apilaban VERTICALMENTE
   como bloques en vez de ir en fila — con `flex-wrap` en el contenedor padre eso
   producía el descuadre. Arreglado quitando el wrapper y usando `<Fragment>` con
   conector y card como hijos DIRECTOS de `.evoList` (ya flex). De paso, **colores de
   tipo en las evo-cards** (no los tenían): `/api/pokemon/names` amplió su forma de
   `{id: {es,en}}` a `{id: {names:{es,en}, types:[...]}}` (nuevo
   `findPokemonTypesById()` ya existente, reutilizado — no fue una consulta nueva) y
   los 2 consumidores (`PokemonListPage`, `usePokemonBrowser`) se adaptaron al shape
   nuevo. Verificado con datos reales: Charizard recupera su segundo tipo (`flying`)
   en la card de evolución, que antes se mostraba gris genérico.
7. **Espacio entre sticky bars y navbar**: antes quedaban pegadas (`top` sin margen);
   ahora `.backLink` en `top: 4.2rem` y `.tabs` en `top: 6.9rem`, con hueco visible
   entre las tres barras (nav app → breadcrumb → anclas). `scroll-margin-top` de las
   secciones y el `rootMargin` del scrollspy ajustados a juego (9.7rem / -175px).
8. **Cards de movimiento con alturas distintas**: resuelto de raíz por el punto 1 (la
   tabla tiene filas de alto uniforme por naturaleza).
9. **Espacio vacío en los laterales** (mismo punto que "reducir espacio libre a los
   lados", pedido dos veces): `.page` max-width 1520px → 1900px, padding horizontal
   2rem → 1.25rem.
10. **Animación de las barras/gráfica de Stats + más tamaño**: `StatRadarChart` gana
    prop `animate` (arranca a `scale(0.35)`+opacity 0, crece a escala 1 con
    `cubic-bezier` de rebote) y `SIZE` 240→300px; `.statBarFill` anima su `width` con
    la misma transición, arrancando en 0% (estado `statsAnimated`, activado un
    `requestAnimationFrame` después del montaje, reiniciado al cambiar de Pokémon vía
    `idOrName` en las deps). `.statBars`/`.statBarTrack`/fuentes agrandados a juego.

**Verificado:** `vite build` de producción compiló limpio en cada paso. Con datos
reales (no simulados): orden por nivel de Charizard pone nivel 0 antes que nivel 1 y
manda los null (MT/tutor) al final; orden por tipo alfabético correcto; cadena
evolutiva Charmander→Charmeleon→Charizard recupera tipos reales por etapa
(`['fire']`, `['fire']`, `['fire','flying']`). **No verificado a ojo en navegador**
(sin `claude-in-chrome` en toda la sesión) — la animación de las barras/radar, el
colapso animado de secciones y el espaciado sticky son la parte más sensible a
confirmar visualmente.

## Ronda de retoques 3 de la ficha — parcialmente hecho 2026-08-17

David pidió 6 cosas más; 4 hechas, 2 pendientes de su decisión (investigadas a fondo,
no implementadas a ciegas):

**Hecho:**
- Tabla de movimientos: TODAS las columnas ordenables ahora (antes solo nivel/nombre/
  tipo/clase, faltaban Pot./PP/Prec. — añadidas a `MOVE_SORTS`, con `null` para
  movimientos no cacheados igual que el resto).
- Despliegue de descripción de movimiento animado: mismo truco de `grid-template-rows`
  que las secciones, pero dentro de un `<td>` (una fila `<tr>` no soporta
  `display:grid` bien) — la fila de descripción ahora se renderiza siempre (oculta a
  0fr) en vez de montar/desmontar.
- Breadcrumb + barra de anclas **fusionados en una sola barra sticky** (antes dos
  barras apiladas con demasiado hueco, y el breadcrumb "no quedaba bien" — pedido
  explícito de rediseño). `top: 4.1rem` (antes 4.2rem+6.9rem en dos barras separadas),
  breadcrumb como primer elemento dentro de `.tabs` con un separador vertical.
- Hero más grande (`heroBands` 22rem→27rem, `scanChamber` 17rem→21rem, columna lateral
  380px→420px) + **botón macho/hembra**: usa los sprites `_hembra.webm` que YA
  estaban en `public/animated/` (confirmado: 99 archivos, cubren especies con
  dimorfismo visual real como Meowstic/Pyroar/Frillish/Indeedee/Basculegion — no solo
  variedades PokeAPI tipo `pikachu-f`). Nuevo hook `useFemaleSpriteAvailable` con
  comprobación HEAD. **Bug real encontrado y corregido**: el servidor de dev de Vite
  devuelve 200 + `index.html` (fallback de SPA) para CUALQUIER ruta que no existe,
  así que `res.ok` no distinguía "existe" de "no existe" — verificado con curl
  (`bulbasaur_hembra.webm`, que no existe, daba 200 `text/html`). Arreglado
  comprobando `content-type` empieza por `video/`, no solo el status HTTP. Verificado
  con curl real: `meowstic_hembra.webm` → `video/webm` (sí), `bulbasaur_hembra.webm`
  → `text/html` (no).

**Investigado, pendiente de decisión de David — NO implementado a ciegas:**
- **Botones de cry y shiny**: David marcó "existen los .webm" como una afirmación a
  comprobar. **Es falsa tal cual la planteó**: no hay ningún `.webm` de shiny en
  ningún sitio (ni en `Pokedex_API` ni en `PokeWebMax`). Lo que SÍ existe en
  `Pokedex_API/app/src/main/res/raw/`: 1424 sprites shiny animados en formato
  **`.webp`** (no `.webm`) — formato distinto, y probablemente MÁS simple de
  renderizar (WebP animado soporta canal alfa nativo, no haría falta el hack de
  chroma-key por canvas que usa `useChromaKeyVideo` para los `.webm` actuales). Cry:
  **no existe ningún archivo de audio** en `Pokedex_API` (solo `cry_logo.png`, un
  icono de UI, no el sonido) — habría que sacarlo de la propia PokeAPI
  (`pokemon.cries.latest`, URL externa) o de otra fuente, no hay nada que copiar.
  Pendiente: decidir si (a) se copian los 1424 `.webp` shiny y se cachea/sirve el
  cry desde PokeAPI, y (b) confirmar que el botón de shiny usa `<img>` normal en vez
  del pipeline de canvas+chroma-key.
## Fallback de WikiDex a "paridad total" (habilidades/movimientos) — HECHO 2026-08-17

David pidió que el fallback de WikiDex no fuera solo para descripciones de especie,
sino para cualquier info que hoy cae a inglés. Primera medición (por cruce de nombre
exacto, sin el patrón de título compuesto) dio 68%/70% de cobertura en habilidades/
movimientos — **David dudó de ese número explícitamente** ("¿seguro que no se ha
incluido...? puede que no te haya entendido") y tenía razón: el fallo era metodológico,
no del dump.

**El bug real**: WikiDex titula las páginas de movimiento/habilidad como
`Hispanoamérica/España` cuando el nombre difiere entre regiones (ej. `Tacleada/Placaje`
para Tackle: es-419='Tacleada', es='Placaje'; `Atactrueno/Rayo` para Thunderbolt) — el
mismo criterio Ha-antes-que-Es que `{{NombreHaEs}}`, pero en el TÍTULO de la página, no
solo dentro del wikitext. Comprobando también `es-419` y el título compuesto, la
cobertura real salta a **911/937 movimientos (97%) y 290/373 habilidades (78%)**.
Cobertura INCREMENTAL real (lo que de verdad importa — cuántas de las que HOY están en
inglés se arreglan): **93 de 111 movimientos sin ES en PokeAPI, y 40 de 106 habilidades
sin ES en PokeAPI** — movimientos pasan de 88%→98% en español, habilidades de 72%→82%.

**Implementado** (mismo patrón arquitectónico que el fallback de descripción de
especie — Python extrae, PHP cruza y escribe):
- `scripts/wikidex_parser.py`: `parse_effect()` (bloque `== Efecto ==`, formato TOTALMENTE
  distinto al `{{Pokédex}}` de especies — no es plantilla clave=valor, es wikitexto con
  encabezados; cuando hay desglose `=== En combate ===` por generación se usa la ÚLTIMA
  entrada `:texto`, la más reciente, aunque esté redactada como delta de la anterior
  — ej. "La potencia de Placaje se reduce a 40" — mismo criterio de "quedarse con lo
  actual" que el resto del proyecto), `resolve_inline_variants()` (variantes
  `{{NombreHaEs}}`/`{{N}}`/`{{n}}` EMBEBIDAS en prosa, no solo cuando son el valor
  completo — necesario porque aquí aparecen varias veces dentro del mismo párrafo),
  `effect_title_candidates()` (los 4 títulos posibles a probar).
  - **Dos bugs de límite de sección encontrados y corregidos durante la validación**
    (mismo patrón de "valida contra el dump completo antes de dar por bueno" que ya
    dio resultado la vez anterior): headings de nivel 4 (`==== Glitches ====`) no se
    detectaban como límite y se colaban enteros en el texto; comentarios HTML
    (`<!--...-->`) no se limpiaban. Verificado tras el fix: 1091/1092 entradas sin
    ningún resto de markup (99,9%), el único caso restante es un `<!--` sin cerrar en
    el wikitext FUENTE (typo real de WikiDex, no del parser).
  - `scripts/wikidex_export_effects.py`: exporta TODAS las páginas con `== Efecto ==`
    (2621, no solo habilidades/movimientos — ítems, bayas, cartas TCG también lo usan)
    a `backend/var/wikidex_import/effects.json`. Deliberadamente sin filtrar por tipo
    de página en Python — el comando de importación en PHP es quien sabe qué nombres
    busca (mismo reparto de responsabilidades que el resto del pipeline WikiDex).
- Backend: entidad `WikidexEffectText` (`resourceType` 'ability'|'move' + `resourceId`,
  no dos tablas separadas), `WikidexEffectTextRepository`, comando
  `app:wikidex:import-effects` (cruza por `PokeApiResourceCacheRepository::
  findLocalizedNamesByType()`, nuevo método generalizado de la que antes solo servía
  para species). Migración aplicada, comando ejecutado: 1091 filas reales en BD.
  `PokemonFichaAssembler` expone `wikidexEffectText: {ability: {id: texto}, move: {id:
  texto}}`, filtrado a solo las habilidades/movimientos de ESE Pokémon (no las ~1100
  importadas enteras en cada respuesta).
- Frontend: `latestVersionedText()` en `utils/pokemonFicha.js` gana un cuarto parámetro
  `wikidexText` (mismo patrón que `wikidexFlavorText` en `flavorTextsByVersion`) —
  tercer nivel de fallback tras PokeAPI-ES/PokeAPI-EN, cuenta como `translated: true`.
  Conectado en las dos llamadas de `PokemonFichaPage.jsx` (habilidades y movimientos).

**Verificado con datos reales de extremo a extremo** (no simulado): la habilidad
"Disemillar" (seed-sower) de Arboliva pasa de `translated: false` (inglés, sin dato en
PokeAPI) a `translated: true` con texto real de WikiDex, a través del pipeline completo
(BD → PokemonFichaAssembler → latestVersionedText → UI). `vite build` compiló limpio.

**Pendiente (mencionado, no bloqueante)**: David tiene shiny en `.webm` funcionando en
su Dexter local — contradice lo encontrado en `Pokedex_API` (que solo tiene `.webp`).
Lo dejó como pendiente para buscarlo él mismo; cry también pendiente (sin fuente de
audio confirmada todavía).

## Ronda de retoques 4 de la ficha — HECHO 2026-08-17

Siete retoques más sobre el rediseño de la ficha (colapso, stats animados, selects,
formas):

1. Tabla de movimientos con alto fijo (`max-height: 30rem`) y scroll interno propio
   (`.moveTableWrap`), cabecera `<thead>` sticky dentro de ese scroll — antes una
   tabla de 80+ movimientos obligaba a hacer scroll larguísimo por toda la página.
2. Animación de las barras/radar de Stats **derivada**, no un `useState` propio con
   reset manual: `statsAnimated = statsInView && !collapsedSections.has('STATS')`.
   `statsInView` viene de un `IntersectionObserver` dedicado sobre la sección STATS.
   Al ser derivada, se reinicia sola tanto al salir de vista por scroll como al
   colapsar la sección, sin lógica extra — la transición CSS ya existente hace el
   resto.
3. Breadcrumb: "Pokémon" → "Atrás".
4. Todas las secciones colapsadas por defecto al abrir la ficha
   (`collapsedSections` inicial = todas las keys de `FICHA_SECTIONS`, reiniciado por
   `idOrName` al navegar a otra ficha). Como consecuencia necesaria (no pedida pero
   requerida para que las anclas sigan siendo útiles): `scrollToSection()` ahora
   también expande la sección de destino antes de hacer scroll.
5. **Nuevo componente `TypeSelect`** (`components/TypeSelect/`): un `<select>` nativo
   no puede pintar icono+color por `<option>` de forma fiable entre navegadores, así
   que es un desplegable propio (botón + lista flotante), cada opción con el icono y
   el color de fondo del tipo (reusa `typeColor`/`typeIconUrl`/`typeName` de
   `pokemonTypes.js`, mismos datos que `TypeBadge`). Sustituye los `<select>` de
   Tipo 1/Tipo 2 en `PokemonFilters`. El select de ordenación de `/pokemon` y el de
   columnas de movimientos se quedan nativos (no pedido, no tienen color/icono que
   mostrar).
6. `sectionHeading` de cada sección coloreado con `primaryColor` (color del tipo
   principal del Pokémon) vía prop `color` en `SectionHeading`, aplicado a texto,
   borde inferior y chevron.
7. Sección Formas: cards con sprite (`payload.sprites.front_default`) + degradado de
   color de tipo (mismo lenguaje visual que las cards de evolución) en vez de texto
   plano en una lista. No son `<Link>` (una forma no siempre es un Pokémon cacheado
   navegable aparte, a diferencia de una etapa evolutiva).

**Verificado:** `vite build` de producción compiló limpio. Sprites reales de formas
confirmados con Unown (28 formas, cada una con su propio sprite,
`201-b.png`/`201-c.png`/...). **No verificado a ojo en navegador** — sin
`claude-in-chrome` en toda la sesión; el desplegable de `TypeSelect` (click-fuera,
Escape, posicionamiento del menú flotante) y la animación de Stats al hacer scroll
son la parte más sensible a confirmar visualmente.

## Formas regionales/megas/gigamax + tema claro/oscuro — HECHO 2026-08-17

**Bug real encontrado (no una feature sin construir)**: la pestaña Formas usaba
`pokemon.forms` de PokeAPI, que solo da la forma por defecto de ESE pokemon en
concreto — para ver regionales/mega/gigamax hay que ir a `species.varieties`.
Verificado con Raichu: `forms` daba 1 entrada, `varieties` da las 4 reales (base,
alola, mega-x, mega-y), cada una con tipos propios distintos (alola es
eléctrico/psíquico) y las 4 ya cacheadas.

David quería las variantes visibles en DOS sitios (pregunta cerrada explícitamente:
"en ambos... eso resolvería el problema?"):

1. **Pestaña Formas de la ficha**: `PokemonFichaAssembler` ahora resuelve
   `species.varieties[].pokemon` como recurso `pokemon` (no `pokemon-form` — los
   espacios de id de ambos recursos NO coinciden entre sí, confirmado con SQL: el
   `pokemon-form` id 10100 no es "raichu-alola", es una forma de Vivillon; hay que
   seguir la URL real, no adivinar el id). Las cards ahora son `<Link>` a
   `/ficha/{id}` con degradado de color de TIPO REAL de cada variante (antes usaba el
   color del Pokémon base para todas). **Contrapartida aceptada**: al usar el recurso
   `pokemon` en vez de `pokemon-form`, se pierde el nombre localizado
   ("Raichu de Alola" → "raichu alola" formateado) porque `pokemon` no trae `names`
   — resolver ambos recursos a la vez para tener nombre Y tipo se descartó por
   complejidad/beneficio.
2. **Lista principal, solo cuando el filtro correspondiente está activo**: nuevo
   campo `variants` en `PokemonListService::listAll()` (id/nombre/tipos por variante,
   `kind: 'mega'|'gmax'|'regional'`, mismo `findPokemonTypesById()` ya existente).
   `usePokemonBrowser.js`: `expandToVariants()` — si el filtro Mega/Gigamax/Regional
   está activo, la card muestra la VARIANTE real (id/nombre/tipos propios) en vez de
   la especie base; si una especie tiene varias variantes que encajan a la vez (ej.
   Raichu con mega X e Y) se muestran ambas. Verificado con datos reales: filtrar por
   Mega da 97 resultados reales (Venusaur-Mega, Charizard-Mega-X con tipo
   fuego/dragón real, etc.), no las especies base sin transformar. La lista SIN
   filtrar sigue siendo solo las ~1025 especies, sin cambios ahí.

**Tema claro/oscuro con interruptor** — antes solo `prefers-color-scheme` automático,
sin forma de forzarlo. `contexts/ThemeContext.jsx` (mismo patrón que
`LanguageContext`): `data-theme="light"|"dark"` en `<html>` solo se escribe cuando el
usuario toca el interruptor (antes de eso sigue al sistema sin más), persistido en
localStorage. CSS en `index.css`: `:root:not([data-theme='light'])` dentro del
`@media (prefers-color-scheme: dark)` (oscuro automático salvo que se haya forzado
claro) + `:root[data-theme='dark']` fuera del media query (fuerza oscuro aunque el
sistema esté en claro). Botón en el navbar con icono sol/luna en SVG inline (no
emoji, sin precedente de emoji en toda la app).

**Verificado:** `vite build` de producción compiló limpio en cada paso; `variants`
con datos reales de Raichu y filtro Mega probado con la lista completa de 1025
especies vía fetch real al backend. **No verificado a ojo en navegador** — sin
`claude-in-chrome` en toda la sesión.

## Sprites animados (mapeo webm) + navbar rojo en claro + retoque de paleta — HECHO 2026-08-17

**Bug de sprites animados que caen al fallback de icono** (ejemplos dados: Pokémon
Paradoja, Vivillon, Toxtricity, "etc."). Auditado sistemáticamente, no solo los
ejemplos dados: script node contra los 1351 `pokemon` cacheados vs los 1493 ficheros
reales en `public/animated/`, primero comprobando existencia exacta del nombre que
genera `animatedSpriteResourceName()` (284/1351 sin match), luego buscando candidatos
por prefijo del nombre base para separar bugs de mapeo reales de contenido
genuinamente ausente del pack.

Resultado: **222 entradas nuevas en `NAME_OVERRIDES`** (`frontend/src/utils/animatedSprite.js`)
cubriendo formas regionales/de género/Gigantamax/Totem/gorras cosméticas de
Pikachu/tamaños de Pumpkaboo-Gourgeist/etc. cuyo nombre en español no encajaba en
ningún caso del switch existente (ej. `vivillon` → `vivillon_floral`,
`toxtricity-amped` → `toxtricity_aguda`, `toxtricity-low-key` → `toxtricity_grave`,
`aegislash-blade` → `aegislash_filo`, formas Origin/Primal/Therian/Incarnate de
legendarios, etc.). Verificado con script que confirma que las 222 claves apuntan a
ficheros reales existentes (0 valores inválidos) y que tras el fix quedan 1288/1351
resueltos (antes 1067/1351).

**Quedan 63 sin resolver, y son genuinamente irresolubles con el pack actual (no es
un bug de mapeo)**: los 17 Pokémon Paradoja (great-tusk, iron-*, flutter-mane,
raging-bolt, roaring-moon, sandy-shocks, walking-wake, scream-tail, slither-wing,
brute-bonnet, gouging-fire) y 46 "Mega"/"Mega-Z" de fantasía que no existen en los
juegos oficiales pero sí están cacheados como `species.varieties` (ej. mega
Chimecho, mega Falinks, mega Scovillain, mega Zygarde, Raichu-Mega-X/Y) — no hay
asset `mega_x.webm` para ninguno de estos en el pack, solo la forma base. Esto no es
un bug: son huecos de contenido reales, igual que los Paradoja. Si David consigue
más `.webm` en el futuro basta con añadirlos a `public/animated/` sin tocar código
(o añadir la entrada a `NAME_OVERRIDES` si el nombre de fichero no sigue el patrón
por defecto).

**"En Toxtricity no aparecen sus formas"**: investigado a fondo, no reproducible
con los datos actuales. `curl` directo a `/api/pokemon/toxtricity-amped/ficha`
devuelve las 4 variedades reales (amped/low-key/amped-gmax/low-key-gmax) con tipos
correctos, y el JSX de la sección Formas (`PokemonFichaPage.jsx` ~L679) no tiene
ningún filtro que pudiera ocultarlas. Conclusión: esto ya lo arregló el cambio de
`PokemonFichaAssembler` a `species.varieties[].pokemon` de la ronda anterior (ver
sección de arriba) — el mensaje de David probablemente es de antes de que ese fix
se desplegara. **No verificado a ojo en navegador** (sin `claude-in-chrome`), solo
por API — si sigue sin verse tras esto, es un bug de renderizado distinto a
investigar aparte.

**Navbar rojo en tema claro + retoque de paleta**: se añadió un juego de tokens
específicos de navbar (`--nav-bg`, `--nav-text`, `--nav-text-muted`, `--nav-border`,
`--nav-active-bg`, `--nav-active-border`, `--nav-brand-dot`, `--nav-pill-bg`,
`--nav-pill-border`) en `index.css`, separados de `--chassis-*`/`--signal` a
propósito para no arrastrar el cambio a cards/badges/otros usos de esos tokens.
En claro: rojo Pokédex (`#cc2b2b` con blur), texto crema, punto de marca dorado
(`#ffd23f`, solo decorativo — el badge de idioma activo sigue usando `--signal`
para no romper el contraste ya probado texto-blanco-sobre-signal). En oscuro: los
mismos valores de siempre (chasis translúcido), solo redirigidos a los tokens
nuevos — cero cambio visual ahí. `App.module.css` (`.nav`, `.brand`, `.brandDot`,
`.links a`, `.navActive`, `.langSwitch`, `.langButton`, `.langActive`,
`.themeToggle`) reescrito para usar los tokens de navbar en vez de `--chassis-900`/
`--text`/`--signal` directos. Retoque adicional de paleta base (ambos temas, sin
tocar `typeColor()`/colores de acento de tipo en la ficha, que David pidió
respetar explícitamente): claro pasado de gris frío puro a neutros ligeramente
cálidos (`--chassis-950/900/800`, `--line`, `--text`, `--text-h`) para que
combinen con el rojo del navbar en vez de chocar; `--signal` en claro afinado de
`#b8630a` a `#c2660a`; oscuro con chasis algo más profundo/saturado
(`--chassis-950` `#14171d`→`#12151b`, `--chassis-800`/`--line` con un pelín más de
tinte azulado). Cambios contenidos a propósito — "un toque", no un rediseño.

**Verificado**: `vite build` de producción limpio; `oxlint` sin avisos en los JS/JSX
tocados; grep del CSS compilado confirma que `--nav-bg` resuelve a rojo sólido en
claro (`#cc2b2beb`) y al chasis translúcido de siempre en oscuro
(`color-mix(in srgb, var(--chassis-900) 88%, transparent)`), y que `--nav-brand-dot`
resuelve a `#ffd23f`/`var(--signal)` respectivamente. **No verificado a ojo en
navegador** (sin `claude-in-chrome` en toda la sesión) — pendiente que David
confirme visualmente que el contraste/aspecto del navbar rojo y del retoque de
paleta le convencen.

## Pack animado: webm→webp, Gigamax local y selector de decoración — HECHO 2026-08-17

**Migración webm→webp**: David sustituyó el pack `.webm` de `public/animated/` por uno
`.webp` que además ya incluye shinies. El nuevo pack tiene **canal alfa real**
(comprobado con PIL: esquinas de un frame dan alpha=0, no fondo blanco), así que se
pudo eliminar por completo el hack de chroma-key por `<canvas>`
(`useChromaKeyVideo.js`, `useVideoFallback.js` borrados) — `PokemonHeroSprite` ahora
es un `<img>` normal. `animatedSprite.js` cambió extensión a `.webp` y ganó
`shinyAnimatedSpriteUrl`/`femaleShinyAnimatedSpriteUrl`. Nuevo toggle ☆/★ combinado
con el ♂/♀ existente (`useAnimatedSpriteVariants.js`, sustituye a
`useFemaleSpriteAvailable.js`, comprueba `_hembra`/`_shiny`/`_hembra_shiny` con HEAD
en paralelo) — si la combinación exacta género+shiny no existe para la especie
activa, cae a shiny normal en vez de perder la animación entera, sin apagar el botón.

**Gigamax local (no Wikidex)**: la app Android de referencia mostraba el sprite
Gigamax hotlinkeado desde `images.wikidexcdn.net` (confirmado leyendo
`LiveSprite.kt`, `dinamaxLiveSprites`). David descargó esos 33 GIFs a
`scripts/dinamax_live_sprites/` y pidió dejar de depender de Wikidex — se movieron y
renombraron a `public/animated/{resourceName}_gigamax.gif` (mismo resourceName que ya
calculaba `animatedSpriteResourceName()` para cada forma Gigamax, verificado con los
33 ids/nombres reales vía `/api/pokemon/{id}/ficha`). `animatedSpriteUrl()` ahora
tiene un caso especial: si el nombre acaba en `-gmax`, apunta a ese `.gif` en vez de
caer a la forma base. Appletun-Gmax (10217) no estaba en el material de origen,
sigue cayendo a la forma base como antes — no es un bug, es hueco de contenido real.

**Selector de decoración para especies "un solo `pokemon` con muchas `pokemon.forms`
cosméticas"**: David reportó que a Alcremie "no le aparecen las formas" aunque sí
había `.webp` locales. Investigado a fondo: Alcremie NO tiene 63 `species.varieties`
(solo 2: normal y gmax) — sus 63 combinaciones sabor×decoración son
`pokemon.forms[]` (sub-formas `pokemon-form` cosméticas del mismo `pokemon` id 869),
que `PokemonFichaAssembler` nunca resuelve a propósito (ver comentario en esa clase:
decisión deliberada de una ronda anterior para el caso contrario — Raichu/Toxtricity,
que SÍ son `species.varieties` reales). Como `ficha.pokemon.forms` ya viaja tal cual
en el payload (cero cambio de backend necesario), se añadió un `<select>` en el hero
banner (`PokemonFichaPage.jsx`, condición `pokemon.forms.length > 1`) que elige entre
esas sub-formas para el sprite animado — no las convierte en cards navegables de la
pestaña Formas (siguen sin ID de pokemon propio, no hay a dónde hacer `<Link>`).

Auditado con SQL contra las 1351 `pokemon` cacheadas
(`JSON_LENGTH(payload->'$.forms') > 1`, 27 especies con este patrón) y cableado
NAME_OVERRIDES para todas las que tenían asset real en el pack: Alcremie (63),
Unown (28 — de paso salió un bug real: los sufijos sueltos `-f`/`-m` de las letras F/M
colisionaban con el caso de género `f`/`m` del switch, pensado para `pikachu-f` etc.),
Arceus (18 placas + "unknown" sin asset), Silvally (18 memorias), Vivillon (20
patrones — los 5 últimos, elegant/garden/high-plains/sandstorm/river, identificados
mirando el frame real de cada `.webp` contra el diseño oficial de cada patrón, no solo
por color: es la asociación menos segura de todo el bloque, revisar si algo no cuadra
visualmente), Furfrou (10 cortes), Genesect (4 drives), Flabébé/Floette/Florges (5
colores cada una), Deerling/Sawsbuck (4 estaciones), Cherrim/Shellos/Gastrodon/Burmy.
Total 194/195 combinaciones auditadas resuelven a fichero real. Especies con el mismo
patrón de datos pero SIN asset por variante en el pack (Mothim, Xerneas, Pichu,
Sinistea/Polteageist, Poltchageist/Sinistcha, Scatterbug/Spewpa) se dejaron sin
override — el selector les sale igual pero cae al sprite base, hueco de contenido
real, no bug.

**Caso especial excluido a propósito**: Frillish-male/Jellicent-male/Pyroar-male
tienen el MISMO patrón de datos (`pokemon.forms: [x-male, x-female]` de un único
`pokemon`), pero ese dimorfismo ya lo cubre el toggle ♂/♀ existente (`hasFemale` vía
`useAnimatedSpriteVariants` ya encontraba `frillish_hembra.webp` etc. antes de este
cambio) — se excluyen explícitamente del selector de decoración
(`isMaleFemaleFormPair` en `PokemonFichaPage.jsx`) para no ofrecer dos controles
distintos para elegir lo mismo.

**Verificado**: todo por curl/node contra el backend y el dev server de Vite (HEAD a
`.webp`/`.gif` reales, `content-type` correcto, 404→fallback SPA de Vite detectado
igual que en el resto del pack), y con un script node que resuelve
`animatedSpriteResourceName()` de las 195 combinaciones auditadas contra el
filesystem real. **No verificado a ojo en navegador** (sin `claude-in-chrome` en toda
la sesión) — el selector de decoración en concreto (`<select>` con 63 opciones para
Alcremie) no se ha visto renderizado de verdad, solo probado que cada opción produce
una URL que carga.

## Iconos de MT/MO/DT/mentas + movimiento en su card + fallback WikiDex de Efecto — HECHO 2026-08-17

**Iconos de máquinas por tipo, no por objeto**: MT (`tmNN`), MO (`hmNN`) y DT (`trNN`)
no tienen icono propio en WikiDex — el real depende del TIPO del movimiento que
enseñan (pedido explícito de David, con los 18 iconos de tipo estilo 9ª gen
"`MT_tipo_X_EP.png`" ya descargados a mano). `scripts/build_item_icon_map.py` ganó
`load_machine_type_icons(prefix, version_group_priority)`: cruza `machine`
(item+move+version_group, cacheado al 100%) con el `type` de cada movimiento. El
mismo número de máquina enseña movimientos distintos según el juego, así que hay un
orden de prioridad de version_group por prefijo: MT prioriza `scarlet-violet` (de ahí
sale el estilo "EP" pedido), MO no tiene versión moderna (se quitaron en 7ª gen) así
que usa el juego con MO más reciente en caché, DT solo existió en `sword-shield`. MO y
DT reutilizan el mismo `TM_TYPE_ICON`, sin fichero propio (pedido explícito). Mentas
de naturaleza (`NATURE_MINT_ICON`): no tienen página propia en WikiDex, solo una
tabla-resumen ("Menta") que confirma que el icono solo distingue por la
CARACTERÍSTICA que sube (6 colores para 21 mentas) — esos 6 PNG se descargaron nuevos
de esa tabla. Total del cruce: 957/2223 objetos con icono local (antes 949, antes 928,
antes 694 — ver entradas anteriores de esta sección para el histórico).

**Movimiento enseñado, ahora también en runtime (no solo para el icono)**: nuevo
`PokeApiResourceCacheRepository::findMachineMoveNamesByItem()` (mismo cruce y misma
prioridad de version_group que el script Python — **si se toca uno hay que tocar el
otro**, están duplicados a propósito porque uno corre en Python offline y el otro en
PHP en caliente) + `findLocalizedNamesByTypeIndexedBySlug()` (variante de
`findLocalizedNamesByType` indexada por slug en vez de por resourceId, para cuando
solo se tiene el nombre del movimiento, no su id). `ItemListService::listAll()` y
`ItemFichaAssembler` exponen `move`/`taught_move` respectivamente; `ItemCard`
(`moveLabel`) y `ItemFichaPage` (badge junto a categoría/pocket) lo pintan.

**Fallback WikiDex para "Efecto" de objetos**: David notó que ningún objeto muestra
descripción en español — comprobado con SQL: `item.effect_entries` **nunca** trae
`es` (0 de los comprobados), mismo hueco real ya documentado para ability/move ("0/373
abilities, 0/937 moves", ver "paridad total" más abajo en este fichero). La
infraestructura para resolverlo YA EXISTÍA y no hizo falta tocarla: `WikidexEffectText`
ya es genérica por `resourceType` (columna, no hardcodeada a ability/move), y
`scripts/wikidex_export_effects.py` YA exportaba cualquier página con sección
"== Efecto ==" sin filtrar por tipo (2621 páginas, incluyendo ítems) — el filtro vivía
solo en `WikidexImportEffectsCommand::RESOURCE_TYPES`, que pasó de
`['ability', 'move']` a incluir también `'item'`. Se añadió el candidato de título con
sufijo " (objeto)" (WikiDex desambigua así los nombres de objeto que también
significan otra cosa en la wiki, ej. "Antídoto (objeto)" — mismo caso ya visto en el
cruce de iconos). Resultado: 567 objetos con texto de Efecto en español ahora (antes
0). `ItemFichaAssembler` expone `wikidexEffectText`, `ItemFichaPage` lo pasa como 4º
argumento a `latestVersionedText()` (que ya soportaba este parámetro, sin cambios ahí).
La descripción por versión (`itemFlavorTextsByVersionGroup`) NO tenía este problema —
verificado que ya caía a inglés por version_group individual correctamente (13/13
grupos para Piedra Fuego, 5 en español real + 8 con fallback marcados "EN"); lo que
faltaba era solo Efecto.

**Deliberadamente fuera de alcance** (ver .claude/memory/project_pokewebmax_wikidex_dump_analysis.md
si se retoma): la sección "== Ubicación ==" / plantilla `{{Localización}}` de
objetos — comprobado que solo 2/2330 objetos tienen la primera y que la segunda (269
objetos) contiene prosa narrativa larga (minijuegos, NPCs), no datos puntuales — no se
construyó ningún importador para eso.

**Verificado**: todo por curl/SQL contra el backend en marcha (conteos de match,
`wikidexEffectText` presente en la respuesta para varios objetos reales) y Vite HMR sin
errores. **No verificado a ojo en navegador** (sin `claude-in-chrome` en toda la
sesión).

## Coherencia de layout, bug de ficha, límite de memoria de Mew, rendimiento de listas, método de movimientos — HECHO 2026-08-17

**Ancho de página inconsistente entre vistas**: `ItemsListPage`/`ItemFichaPage` no
tenían `width: 100%` en `.page` — dentro del `.main` flex de `App.module.css`
(`display: flex`, sin `align-items: stretch` explícito pero un flex item sin `width`
propio no se estira al eje principal por defecto) el contenido se encogía a su
contenido en vez de ocupar el ancho disponible (Objetos quedaba en dos columnas
pegadas a la izquierda con medio viewport en blanco). Corregido añadiendo
`padding`/`width: 100%` (Objetos, mismo criterio que `PokemonListPage`) y
`max-width: 1900px` + `margin: 0 auto` + `width: 100%` (ficha de objeto, mismo valor
que la ficha de Pokémon — ese 1900px ya se afinó a propósito en una ronda anterior,
"reducir espacio libre a los lados", no tocar sin motivo).

**Bug real: `PokemonFichaPage` petaba con "Cannot read properties of undefined
(reading 'types')"** al navegar entre Pokémon (ej. por la cadena evolutiva).
`usePokemonFicha` no reseteaba `ficha` a `null` al empezar a cargar un idOrName
nuevo — solo cambiaba `status`. Doble fix: `load()` ahora limpia `ficha` en cuanto
arranca la petición, y el guard de `PokemonFichaPage` pasó de `if (!ficha)` a
`if (!ficha?.pokemon)` (defensa adicional, no depender solo de que `ficha` sea
`null`).

**Mew (y cualquier Pokémon con moveset enorme) daba 500** por agotar el
`memory_limit` de PHP (128M por defecto) al montar el JSON de su ficha — el payload
en bruto de `pokemon` de Mew son ~700KB (375 movimientos) frente a ~290KB de
Bulbasaur, y con el profiler de Symfony en modo dev clonando la respuesta para el
toolbar el límite por defecto no basta. Subido a 512M en `docker/backend.Dockerfile`
(`CMD ["php", "-d", "memory_limit=512M", ...]`), reconstruida la imagen.

**Listas lentas (`/api/pokemon` ~4-5s, `/api/items` ~0,8s) — causa real:
`JSON_EXTRACT` no evita leer la columna `payload` completa por fila.** Medido con SQL
directo: sacar `types` de las ~1350 filas de `pokemon` (¬132KB de media, hasta 700KB
en Mew) cuesta ~1,5s; peso/altura/stats otros ~2,8s — el motor tiene que leer y
parsear el TEXT/JSON entero de cada fila para el `JSON_EXTRACT` aunque el resultado
que viaja a PHP sea pequeño. Dos fixes en `PokeApiResourceCacheRepository`/services:
1. `findPokemonTypesAndMetricsById()` combina en una sola pasada lo que antes eran
   dos consultas separadas sobre la misma tabla (`findPokemonTypesById` +
   `findPokemonListMetricsById`, que siguen existiendo sueltas para quien solo
   necesite una de las dos — `namesById()` sigue usando la de tipos sola).
2. El verdadero salto de rendimiento: `PokemonListService::listAll()` y
   `ItemListService::listAll()` cachean el resultado YA COMPUTADO con
   `Symfony\Contracts\Cache\CacheInterface` (`cache.app`, TTL 300s) en vez de la
   query — no hay forma barata de evitar la lectura cara sin columnas generadas +
   índice (cambio de esquema mayor, no abordado). De paso,
   `PokeApiClient::fetchResourceList()` (la lista maestra que pide a la PokeAPI real)
   también se cachea, TTL 6h. **Ojo con dónde vive el pool**: `cache.app` en este
   proyecto usa `var/share/{env}/pools`, NO `var/cache/{env}` — `bin/console
   cache:clear` NO lo vacía (hace falta `cache:pool:clear cache.app`), así que un
   cambio en la lógica cacheada puede tardar hasta el TTL en notarse tras un deploy.
   Medido antes/después: `/api/pokemon` 4,5s → 0,03-0,08s en caliente; `/api/items`
   0,75s → 0,03s.

**Columna "Nivel" de la tabla de movimientos ahora es "Método"**: David señaló que
solo mostraba el nivel, pero un movimiento puede venir por MT/MO, cría o tutor
también, y que no hay iconos descargados de WikiDex para esto. Comprobado el
proyecto Android de referencia (`Movimientos.kt`,
`determineLearnIndicatorText`/`formatMoveLearnMethod`): tampoco usa iconos ahí, solo
texto ("Nivel", "MT/MO", "Tutor", "Huevo") — mismo criterio seguido aquí en vez de
buscar assets que no existen. `moveLevelLearned()` →
`moveLearnMethod()` en `pokemonFicha.js`, devuelve `{method, level}` con prioridad
Nivel > MT/MO > Tutor > Cría mirando TODOS los juegos donde aparece el movimiento
(no solo el más reciente, para no perder "Nivel" si en algún juego antiguo se
aprendía así). Nueva `moveLearnMethodName()` para la etiqueta ES/EN. El orden por
defecto de la columna ahora agrupa por método (mismo orden de prioridad) y por nivel
dentro del grupo Nivel.

**Verificado**: todo por curl/SQL/node contra los contenedores en marcha (timings
antes/después, resolución de método por movimiento con Bulbasaur, `pocket_name`/
`taught_move` en las respuestas reales) y Vite/Symfony sin errores tras cada cambio.
**No verificado a ojo en navegador** (sin `claude-in-chrome` en toda la sesión) — el
propio bug de `PokemonFichaPage` lo reportó David tras verlo él mismo en el
navegador, así que el resto de vistas (layout de Objetos, columna de movimientos)
convendría que las mire también antes de darlas por buenas del todo.

## Pendiente / siguiente paso natural

- No hay vistas de listado/detalle navegable para ningún recurso salvo Pokémon — el resto
  (49 recursos) solo tienen el botón de cacheo masivo en `/cache`, sin forma de ver el
  contenido cacheado desde el frontend (solo por SQL directo o `bin/console`).
- El cacheo masivo es secuencial (uno a uno) — con recursos grandes (`item` ~2200,
  `location-area` ~1500, `machine` ~2370) puede tardar bastante; paralelizar con un
  límite de concurrencia sería la siguiente mejora natural si se nota lento en la
  práctica.
- La vista Pokémon perdió el campo "tipos" al pasar a `pokemon-species` (ver arriba) — se
  podría recuperar ahora que `pokemon` también es cacheable, cruzando ambos recursos.
- Ninguna vista tiene paginación — con todo cacheado serían miles de cards de golpe en
  varios recursos.
- Cualquier código nuevo que consulte `PokeApiResourceCache` en bloque debe usar
  proyecciones ligeras (como `findFetchedAtByType`) y no `findBy`/`findAll` completos, por
  el bug de memoria de esta sesión.
- De `DexterWeb` (revisado esta sesión) queda por traer si se quiere: iconos SVG de tipo +
  `typeColors.js`, y el patrón de `PokeApiService` con parseo recursivo de cadena
  evolutiva + traducción por idioma, útil para cuando se aborde la "ficha completa".

## Pase de estética sobre el panel de secciones de la ficha — HECHO 2026-08-18

David compartió una captura (`/home/david/Escritorio/capturas/ficha.png`, Venusaur) y
señaló que se veía "poco estético" — con las 7 secciones colapsadas por defecto (decisión
explícita de David, ver más arriba), el lado derecho de la ficha era casi una pared en
blanco: cada sección era solo un título de texto + una línea, flotando directamente sobre
el fondo de la página, sin superficie ni jerarquía visual propias. El sistema de tokens
(chasis-grafito/ámbar, Chakra Petch+IBM Plex, marco HUD) no se descartó ni se tocó —
mismo criterio que la sesión del 16-08 sobre desktop/grid: David señaló un problema visual
concreto, no pidió repensar la paleta.

**Antes de tocar nada**: se instalaron los plugins `frontend-design`/`superdesign` en esta
máquina (no estaban, ver [[project_pokewebmax_required_plugins]] — sí lo estaban en la
máquina de la sesión que los pidió originalmente). **No llegaron a estar disponibles en
esta sesión** (`Skill(frontend-design)` → `Unknown skill`, necesitan reinicio de sesión
para que el harness los recoja, igual que advierte esa nota) — el rediseño de esta sesión
se hizo a mano, aplicando el mismo criterio de proceso (construir sobre el sistema de
tokens ya existente, no inventar uno nuevo) sin la skill formal. Quedan instalados para la
próxima sesión en esta máquina.

Cambios (todo en `PokemonFichaPage.jsx`/`.module.css` + `index.css`, sin tocar backend
ni otras páginas):
- **`.content` pasa a ser una superficie de tarjeta propia** (`background:
  var(--chassis-900)`, borde, `border-radius`, sombra) en vez de secciones sueltas sobre
  el fondo de la página — mismo lenguaje visual que `.hero`. Cada sección
  (`.sectionBlock`) es ahora una fila dentro de ese panel con padding propio y un
  divisor (`border-bottom`) entre secciones, sustituyendo el hueco de `2.75rem` que
  antes separaba títulos sueltos.
- **Icono por sección** (`SECTION_ICONS`, SVGs inline stroke-based, sin librería nueva —
  mismo criterio que el resto del repo de no añadir dependencias) en un chip cuadrado
  teñido con el color de tipo del Pokémon (`currentColor` heredado), tanto en la cabecera
  de cada sección como en las pestañas de arriba (`.tabPills`) — antes las pestañas y
  cabeceras eran solo texto plano.
- **Subtítulo de una línea bajo cada título** (`sectionPreviews`, ej. "8 versiones", "6
  habilidades", "Total 525"), visible tanto colapsada como abierta — mitiga que una
  sección colapsada se vea "vacía": ahora una fila cerrada sigue comunicando algo sin
  necesidad de abrirla. Nuevas claves i18n `ficha.preview*` en `locales/es.json`/
  `en.json` (interpolación `{{count}}`/`{{value}}`, mismo patrón que `cacheBarMissing`
  ya existente). `evolutionStages(evolutionChain, t)` se hoisteó a una variable
  (`evoStagesList`) para no recalcularlo dos veces (preview + render de la lista).
- **Cabecera de sección con estado hover** (`.sectionHeadingRow:hover`, fondo sutil) —
  antes el único affordance de que la fila era clicable era `cursor:pointer`.
- **Barra de pestañas (`.tabs`) con superficie propia** (fondo + borde + sombra +
  `backdrop-filter`, `border-radius` a juego con el panel de abajo) — antes flotaba
  directa sobre el fondo de la página con solo un `border-bottom`.
- **Marco HUD (`hud-frame`, `index.css`) reforzado**: grosor de línea 2px→3px, inset
  -8px→-10px, `opacity` 0.85→1, + `filter: drop-shadow(0 0 3px currentColor)` — no
  quedaba claramente visible en la captura de David alrededor del sprite de cabecera,
  se subió el contraste. Solo afecta a `.hud-frame::before`; la variante
  `.hud-frame--hover` (usada en `PokemonCard`) sigue con su propia opacidad 0 por
  defecto, sin cambios de comportamiento ahí.

**Verificado**: Vite compila sin errores (`docker compose logs frontend`, tras los
edits no aparece ningún error nuevo — sí había trazas de error viejas en el log de
antes de esta sesión, de ediciones previas, no relacionadas), `/ficha/3` (Venusaur, el
mismo Pokémon de la captura de David) devuelve 200 y el módulo `PokemonFichaPage.jsx`
se sirve sin `PARSE_ERROR`. **No verificado a ojo en navegador** — mismo hueco de
`claude-in-chrome` de toda la vida de este proyecto (se intentó de nuevo esta sesión,
"extensión no conectada"). David debe revisar `http://localhost:5174/ficha/3` y dar
feedback concreto sobre qué mantener/ajustar antes de replicar este patrón de "panel +
iconos + preview" en otras páginas (`PokemonListPage`, `CacheAllPage`, `ItemFichaPage`
no se tocaron en esta sesión).

## Fusión de /status en /cache + tabla compacta de recursos — HECHO 2026-08-18

Misma sesión, a continuación del pase de estética de la ficha. David pidió dos cosas
sobre la vista de caché: **(1)** que `/cache` y `/status` (antes dos páginas y dos
enlaces de nav separados) fueran una sola vista, **(2)** que la lista de 49 recursos
dejara de ser una tarjeta apilada por recurso (mucho scroll) y pasara a una tabla
compacta.

- **`StatusPage.jsx`/`.module.css` eliminados** (dead code tras la fusión, no dejado
  como shim) — su lógica (`useServiceHealth`, `StatusRow`) no se duplicó, se reusa tal
  cual desde un `StatusStrip` nuevo dentro de `CacheAllPage.jsx`: los 3 `StatusRow`
  (frontend/backend/BD) en fila (`styles.statusStrip`, flex-wrap) en vez de apilados en
  un panel centrado aparte, más el botón de reintentar. `App.jsx` pierde la ruta
  `/status` y el enlace de nav "ESTADO" — sin redirect de compatibilidad (app personal
  de un solo usuario, no hacía falta). Claves i18n `nav.status`/`status.eyebrow`/
  `status.title` eliminadas de `locales/es.json`/`en.json` por quedar sin uso; el resto
  del namespace `status.*` (labels/valores de cada servicio) se sigue usando igual
  desde `CacheAllPage`.
- **`ResourceCacheRow` pasa de `<div>` apilado a `<tr>`** dentro de una `<table>` por
  grupo (`RESOURCE_GROUPS` sigue igual, solo cambia el render): nombre del recurso,
  estado (barra mini de progreso/✓ hecho/error, con el error truncado con ellipsis) y
  botón compacto (`.miniButton`, versión más pequeña de `.button`) en 3 columnas. La
  fila del botón maestro "Todo (49 recursos)" se dejó como estaba (tarjeta destacada,
  no es parte de la tabla — sigue siendo la única acción "especial" de la página).
  `.page` sube de `max-width: 34rem` a `52rem` para dar aire a las columnas de la
  tabla. **No se tocó la lógica de cacheo** (`useCacheAllResource`, `useCacheEverything`,
  `cacheAllPending`) — solo el marcado/CSS de cómo se pinta cada fila.

**Verificado**: Vite compila sin errores tras los edits (`docker compose logs
frontend`, sin trazas nuevas), `GET /api/health` sigue devolviendo `{backend:"ok",
database:"ok"}` (usado por `useServiceHealth`), `/cache` devuelve 200, confirmado que
`StatusPage.jsx` ya no existe ni en disco ni en el contenedor (`docker compose exec
frontend ls`) y que pedirlo a Vite cae al fallback SPA (sirve `index.html`, no el
módulo viejo) en vez de servir contenido obsoleto. **No verificado a ojo en
navegador** — mismo hueco de `claude-in-chrome` de siempre.

## Iconos de objeto rotos ("caramelos") — placeholder + diagnóstico, HECHO 2026-08-18

David señaló que algunos objetos (caramelos) no mostraban icono. Investigado: la
cadena de icono de un objeto es `itemIconUrl()` (mapa local derivado de WikiDex, ver
[[project_pokewebmax_progress]] sección "Diseño final" y `scripts/build_item_icon_map.py`)
→ si no está en ese mapa, cae al sprite que aloja el propio repo `PokeAPI/sprites` en
GitHub. **~103 de los 2223 objetos no tienen icono en NINGUNO de los dos sitios**
(confirmado con `curl` contra el repo de sprites, 404 en los casos probados): los ~81
"caramelo de especie" (`bulbasaur-candy`, `charmander-candy`... — resultan ser de
**Let's Go Pikachu/Eevee**, no de Pokémon GO como se pensó al principio, visto en el
propio payload cacheado de `bulbasaur-candy`: `version_group:
lets-go-pikachu-lets-go-eevee`) + `dynamax-candy` + ~21 "candy" de Aventuras Dinamax
(`health-candy`/`mighty-candy`/`tough-candy`/`smart-candy`/`courage-candy`/
`quick-candy`, con tiers ` `/`-l`/`-xl`) + `candy-jar`. **Comprobado contra el propio
dump SQLite de WikiDex** (`scripts/wikidex_dump/wikidex.sqlite`, de David, offline —
solo lectura de datos que él ya obtuvo, sin descargar nada nuevo) que no existe
ninguna página con el título en español que da PokeAPI (`Caramelo Vigor`,
`Caramelo Bulbasaur`...) — sí hay páginas parecidas pero de OTRA cosa distinta
("Pluma Vigor", "Mochi Vigor", "Carga vigor S/M" parecen items de Pokémon Sleep/Legends
Arceus, no de Aventuras Dinamax) — así que esto no es un bug de emparejamiento por
nombre (`build_item_icon_map.py` solo empareja por igualdad exacta tras normalizar, a
propósito, ver comentario del propio script) sino un hueco real: **o WikiDex no tiene
página propia para estos ~103 objetos con ese título exacto, o existe bajo un título
que no se ha localizado todavía.** No se ha intentado tirar de ese hilo más a fondo
(sería trabajo de investigación en la wiki, no algo que resolver desde este repo) ni
se ha descargado ninguna imagen nueva — sigue aplicando la misma línea de siempre
(sprites HOME/animados, ver más arriba): **si David quiere completar estos iconos
tendría que localizar él mismo los títulos/URLs reales en WikiDex y añadirlos a
`scripts/links.txt`**, Claude no descarga assets nuevos de wikidex.net.

**Mitigación aplicada mientras tanto** (sí es código, no descarga de assets): antes,
cuando fallaban AMBOS niveles de `useImageFallback` (local y el remoto de PokeAPI), el
`<img>` se quedaba con el icono roto del navegador. Se añadió un tercer estado
`exhausted` al hook (`hooks/useImageFallback.js`) — cuando se agotan los dos
fallbacks, `ItemCard`/`ItemFichaPage` pintan un placeholder propio (icono de caja
genérica en SVG inline, mismo criterio que los iconos de sección de la ficha de
Pokémon, sin librería nueva) en vez del `<img>` roto. Cambio retrocompatible: el resto
de consumidores del hook (`PokemonHeroSprite`, `PokemonCard`, cabecera de
`PokemonFichaPage`) ignoran el campo nuevo y siguen funcionando igual.

**Verificado**: Vite compila sin errores tras los edits, `/objetos` y
`/objetos/bulbasaur-candy` devuelven 200, `GET /api/items/bulbasaur-candy/ficha`
confirma el `version_group` que aclaró el origen real de estos objetos (Let's Go, no
GO). **No verificado a ojo en navegador** — mismo hueco de `claude-in-chrome` de
siempre; David debería comprobar en `/objetos` que los caramelos afectados ahora
muestran el placeholder (caja gris translúcida) en vez de un icono roto.

### Bug real en el placeholder de arriba, encontrado con captura — arreglado 2026-08-18

David mandó `/home/david/Escritorio/capturas/a.png` (buscador de objetos filtrado por
"caram") y el placeholder de la sección anterior **no se veía** — seguía saliendo el
icono roto del navegador con el `alt` desbordando por encima de la tarjeta. Causa
raíz: `itemIconUrl(slug)` (`utils/itemSprite.js`) YA hace su propio fallback interno a
la url remota de PokeAPI cuando el objeto no está en el mapa local — así que para
~1166 objetos (todo lo no mapeado, incluidos los ~103 "caramelo") `ItemCard`/
`ItemFichaPage` llamaban a `useImageFallback(primarySrc, fallbackSrc)` con
`primarySrc === fallbackSrc` (la misma url remota repetida dos veces). Al fallar esa
única url, el hook cambiaba a "modo fallback" pero reasignaba el `<img src>` al mismo
string que ya tenía — un `src` sin cambiar no dispara un `onError` nuevo en el
navegador, así que `fallbackFailed` nunca llegaba a `true` y `exhausted` se quedaba
atascado en `false` para siempre. El placeholder de la sesión anterior nunca llegaba a
activarse en la práctica para ningún objeto sin mapeo local (que es precisamente el
caso más común de "objeto sin icono").

Arreglado en `hooks/useImageFallback.js`: si `primarySrc === fallbackSrc` (o no hay
`primarySrc`), el hook entra en "modo fallback" desde el primer render en vez de
esperar un primer fallo que nunca reasignaría nada — así solo hace falta UN intento de
carga fallido (no dos) para marcar `exhausted`. Resto de consumidores del hook
(`PokemonCard`, `PokemonHeroSprite`, cabecera de ficha) no se ven afectados: sus dos
urls sí son siempre distintas entre sí, así que su comportamiento (probar la local,
caer a la remota si falla) no cambia.

**Verificado**: Vite compila sin errores tras el fix. **Seguimos sin poder verlo a
ojo en navegador** (mismo hueco de `claude-in-chrome`) — esta vez el bug se encontró
gracias a que David SÍ pudo mandar una captura real con el síntoma, así que merece la
pena que confirme de nuevo en `/objetos?buscar=caram` (o el filtro que use) que ahora
sale el placeholder de caja en vez del icono roto.

## Ancho de las fichas igualado al resto de vistas + hero fluido — HECHO 2026-08-18

David pidió que `/ficha/:id` (y por extensión `/objetos/:id`) aprovechara el mismo
ancho horizontal que las vistas de lista, y que se ajustara también el tamaño del
hero. Causa: `PokemonFichaPage.module.css`/`ItemFichaPage.module.css` tenían
`.page { max-width: 1900px; margin: 0 auto }`, mientras que `PokemonListPage`/
`ItemsListPage` no tienen `max-width` (solo `width: 100%`) — en pantallas más anchas
que 1900px (la de David es de 2547px, ver capturas de esta sesión) la ficha se veía
más estrecha que la lista de la que se venía navegando.

- **`.page` de ambas fichas**: quitado el `max-width: 1900px` — mismo criterio que las
  listas, sin tope propio.
- **`.layout` (columna del hero en `PokemonFichaPage`)**: de `grid-template-columns:
  420px 1fr` fijo a `clamp(380px, 25vw, 560px) 1fr` — al quitar el tope de `.page`,
  dejar el hero a un ancho fijo lo habría hecho ver cada vez más pequeño en relación
  al resto de la página en pantallas anchas.
- **`.scanChamber` (marco del sprite) fluido de verdad**: de `21rem` fijos a `width:
  78%; aspect-ratio: 1` (relativo a `.heroBands`, que a su vez hereda el ancho de la
  columna del hero) — crece con la columna en vez de quedarse fijo dentro de una
  tarjeta cada vez más grande. `.heroBands` pasa de `height: 27rem` fijo a
  `clamp(27rem, 30vw, 36rem)` para que siempre quepa el cuadrado de `.scanChamber` sin
  recortarlo (`overflow: hidden` en `.heroBands`) en ningún punto del rango.
- **`ItemFichaPage`**: mismo quitado de `max-width`; `.iconWrap` (icono del objeto en
  la cabecera) subido de `6.5rem` a `8rem` — su hero es una fila simple icono+texto,
  no una rejilla de dos columnas como el de Pokémon, así que no necesitaba una
  solución fluida, solo un tamaño algo mayor acorde a la página más ancha.

**Verificado**: Vite compila sin errores (`docker compose logs frontend`), `/ficha/3`
y `/objetos/rare-candy` devuelven 200. **No verificado a ojo en navegador** — mismo
hueco de `claude-in-chrome` de siempre; David debería confirmar en su pantalla ancha
que la ficha ya llega al mismo borde que `/pokemon`/`/objetos` y que el hero se ve
proporcionado (ni enano ni desbordado) en ese ancho.

## Scroll interno de .content + acordeón de una sola sección — HECHO 2026-08-18

David pidió dos cambios más sobre la ficha: **(1)** que el scroll fuera interno a
`.content` (el panel de las 7 secciones) en vez de la página entera, y **(2)** que
solo una sección pudiera estar desplegada a la vez (antes cada una tenía su propio
estado independiente en un `Set`, así que David podía tener DESC+STATS+MOVES abiertas
a la vez, lo que era justo lo que hacía crecer la página sin límite).

- **Acordeón de una sola sección**: `collapsedSections` (`Set` de claves colapsadas,
  todas colapsadas por defecto) sustituido por `openSection` (clave abierta o `null`,
  sigue arrancando en `null` = todo colapsado, mismo comportamiento por defecto de
  siempre). `toggleCollapse(key)` ahora es `setOpenSection(prev => prev === key ? null
  : key)` — abrir una cierra automáticamente cualquier otra. `expandSection(key)` (la
  usa `scrollToSection` al pulsar una pestaña de arriba) pasa a `setOpenSection(key)`
  sin condición. `SectionHeading` recibe `openSection` en vez de `collapsed` (Set) y
  compara `sectionKey !== openSection`. `statsAnimated` (dispara el crecimiento del
  radar de stats) pasa de `!collapsedSections.has('STATS')` a `openSection ===
  'STATS'`. Se resetea a `null` en el mismo `useEffect` que ya reseteaba el colapso al
  cambiar de ficha (`[idOrName]`).
- **Scroll interno**: `.content` (`PokemonFichaPage.module.css`) gana `max-height:
  calc(100vh - 12rem)` + `overflow-y: auto` (antes `overflow: hidden` sin límite de
  alto, la página entera crecía). El presupuesto de `12rem` es una estimación
  generosa del nav de la app + la barra de pestañas sticky + el hueco entre ambas, no
  un cálculo exacto — **David debería confirmar visualmente y avisar si sobra o falta
  espacio**, es el típico ajuste que no se puede verificar sin navegador. En móvil
  (`@media max-width:900px`, donde el hero deja de ser sticky y las pestañas dejan de
  ser anclas) se desactiva el tope (`max-height:none; overflow:visible`) — un scroll
  anidado se siente peor que el scroll de página normal en touch. `scroll-margin-top`
  de `.sectionBlock` bajado de `7.5rem` a `0.5rem`: compensaba el nav+pestañas sticky
  del scroll de página entera, que ya no aplica dentro del scroll interno de
  `.content`. `scrollIntoView` (usado por `scrollToSection` al pulsar una pestaña)
  sigue funcionando igual sin cambios de JS — por spec, scrolla el ancestro
  desplazable más cercano, que ahora es `.content` en vez del documento.

**Verificado**: Vite compila sin errores tras los edits (`docker compose logs
frontend`), `/ficha/3` devuelve 200, grep confirma que no queda ningún resto de la
API antigua (`collapsedSections`/`.has(...)` sobre secciones — el único `.has()` que
queda en el fichero es el de `expandedMoves`, que es un `Set` aparte para las filas de
movimiento expandidas, no tocado). **No verificado a ojo en navegador** — mismo hueco
de `claude-in-chrome` de siempre; el ajuste de `12rem` en particular necesita
confirmación visual de David.

**Bug encontrado por David tras probarlo**: la sección MOVES tenía su propio scroll
interno acotado (`.moveTableWrap { max-height: 30rem; overflow-y: auto }`, de la
sesión del rediseño a tabla) — con `.content` ahora también scrollando internamente,
al abrir Movimientos salían DOS scrollbars anidadas. Arreglado quitando el
`max-height`/`overflow-y` de `.moveTableWrap` (se deja `overflow-x: auto`, sigue
haciendo falta en pantallas estrechas porque la tabla no envuelve columnas) — el
scroll vertical de la tabla larga lo absorbe `.content` directamente, una sola
scrollbar. De paso, `.moveTable th` (cabecera sticky de la tabla) pasó de
`background: var(--bg)` (fondo de página) a `var(--chassis-900)` (fondo real de
`.content`, el ancestro scrollable del que depende ahora el sticky) — antes se veía
una costura de color al quedar pegada arriba con las filas pasando debajo.

**Verificado**: Vite compila sin errores tras el fix. **No verificado a ojo en
navegador** — David debería confirmar que al abrir Movimientos ya solo hay una
scrollbar y que la cabecera de la tabla al pegarse arriba no tiene ningún salto de
color visible.

## Hero a todo el alto disponible — HECHO 2026-08-18

David pidió que el hero (columna izquierda, tarjeta con el sprite) ocupe todo el alto
vertical que pueda, en vez de quedarse con el alto que le pidieran sus contenidos
internos (que podía acabar más corto que `.content`, sobre todo en pantallas altas).

- **Variable compartida `--panel-h`** definida en `.layout` (`calc(100vh - 12rem)`,
  el mismo presupuesto que ya usaba `.content` para su scroll interno de la sección
  anterior) — evita que `.hero` y `.content` se desincronicen si se retoca uno de los
  dos números sueltos más adelante.
- **`.hero`**: gana `height: var(--panel-h)` (antes el alto lo determinaba solo el
  flex-column de dentro).
- **`.heroBands`** (la banda de color con el sprite): de `height: clamp(27rem, 30vw,
  36rem)` fijo a `flex: 1; min-height: 0` — absorbe todo el alto que `.hero` tenga de
  sobra tras `.infoBand` (la banda inferior con nombre/número, que no cambió). El
  sprite (`.scanChamber`) sigue acotado por ANCHO (78% de `.heroBands`, `aspect-
  ratio:1`, ver sesión del ajuste de ancho más arriba), así que en pantallas altas el
  hueco extra se reparte como aire por encima del sprite en vez de deformarlo — sigue
  anclado abajo (`align-items: flex-end`).
- **Móvil** (`@media max-width:900px`, donde `.hero` ya volvía a `position: static`):
  `.hero` gana `height: auto` y `.heroBands` vuelve a su `flex: none; height:
  clamp(27rem, 30vw, 36rem)` fijo de antes — sin alto de sobra que repartir en una
  columna apilada, se restauró el tamaño que ya se sabía que funcionaba ahí.

**Verificado**: Vite compila sin errores tras los edits. **No verificado a ojo en
navegador** — mismo hueco de `claude-in-chrome` de siempre; David debería confirmar
que el hero ahora llega hasta abajo del todo emparejado con `.content` y que en móvil
no cambió nada visualmente.

## Sección abierta sube arriba, animado (FLIP) — HECHO 2026-08-18

David pidió que la sección seleccionada (abierta) pase a estar arriba del todo,
dejando el resto debajo, con la transición animada — sobre el acordeón de sección
única de la sesión anterior.

- **Reordenamiento visual vía `order` de flexbox**, no reordenando el JSX: cada
  `<section>` sigue en su sitio de siempre en el árbol (son bloques grandes, con
  bastante contenido propio cada uno — desmontar/remontar habría sido más caro y más
  frágil), pero gana `style={{ order: sectionOrder(key, openSection) }}`.
  `sectionOrder()` devuelve `-1` para la sección abierta (primera) y el índice natural
  (`SECTION_ORDER_INDEX`, orden de `FICHA_SECTIONS`) para el resto, que mantienen su
  orden relativo de siempre detrás.
- **Animación con la técnica FLIP** (First, Last, Invert, Play), hook nuevo
  `hooks/useSectionReorderFlip.js`: expone `capture()` (llamado a mano justo ANTES de
  cambiar `openSection`, dentro de `toggleCollapse`/`expandSection` — un hook no puede
  interceptar el instante justo antes de un cambio de estado que él mismo no dispara)
  que guarda el `getBoundingClientRect()` de las 7 secciones; en un `useLayoutEffect`
  disparado por el cambio de `openSection` compara esas posiciones contra las nuevas
  (ya con el `order` aplicado) y anima cada una con `Element.animate()` (Web
  Animations API nativa, sin librería nueva — mismo criterio que
  `useChromaKeyVideo.js`) desde su delta de posición vieja hasta 0. Se salta
  elementos con rect `0×0` (secciones ocultas en móvil vía `.sectionInactiveMobile`,
  nada que animar ahí).
- **`sectionRefs` (antes declarado más abajo, junto a `scrollToSection`) se subió
  arriba del todo del cuerpo del componente** — tanto el hook de FLIP como
  `scrollToSection` lo necesitan, y en JS hay que declararlo antes de usarlo.
- **Bug encontrado y arreglado de paso, antes de que llegara a verse**: el borde
  inferior de cada fila usaba `.sectionBlock:last-child` para no dibujarse en la
  última — pero `:last-child` mira la posición real en el DOM, no el `order` visual
  de CSS. Con el reordenamiento, en el único caso en que la sección abierta es FORM
  (la última natural) el borde habría quedado mal puesto (en FORM, que pasa a ser la
  PRIMERA visualmente, en vez de en la que de verdad queda última). Arreglado con
  `sectionBlockClassName()` (calcula a mano cuál es la última visual filtrando
  `FICHA_SECTIONS` por la abierta) + clase `.sectionBlockLast` en vez de
  `:last-child`.

**Verificado**: Vite compila sin errores (probado también con `docker compose
restart frontend` para descartar un error transitorio de HMR a media edición —
limpio tras el reinicio), módulo del hook nuevo y de la página sirven 200. **No
verificado a ojo en navegador** — mismo hueco de `claude-in-chrome` de siempre; la
animación en sí (timing, si se nota "viva" o demasiado brusca/lenta a 350ms) es
justo el tipo de ajuste que necesita que David lo vea y dé feedback, no se puede
calibrar a ciegas.

### Corrección: hero debe medir EXACTAMENTE lo mismo que .main — HECHO 2026-08-18

David afinó el pedido de "hero a todo el alto disponible" de la sesión anterior: la
altura del hero debe ser la MISMA que la altura máxima de `.main` (columna derecha:
`.tabs` + `.content`), no una estimación de viewport aparte que podía quedarse corta.
Causa del desajuste anterior: `.hero` tenía `height: var(--panel-h)` pero esa
variable solo cubría el presupuesto de `.content`, sin sumar el alto real de `.tabs` +
el gap entre ambos — así que `.main` en su punto más alto (`.tabs` + `.content` a su
`max-height`) acababa siendo más alto que `.hero`, no coincidían.

Rediseño para que coincidan por construcción, sin dos cálculos que sincronizar a
mano:
- **`.main` gana `height: var(--panel-h)` explícito** (antes su alto era solo la suma
  natural de `.tabs` + `.content`, sin tope ni mínimo propios) — ahora es SIEMPRE
  exactamente `var(--panel-h)`, la misma variable que ya usaba `.hero`.
- **`.content` pasa de `max-height: var(--panel-h)` a `flex: 1; min-height: 0`** —
  como ahora vive dentro de un `.main` de alto fijo (flex-column), reparte
  automáticamente "lo que sobre tras `.tabs`", sea cual sea el alto real de `.tabs`
  (puede pasar a dos líneas en viewports estrechos) — ya no hace falta adivinar ese
  número, antes `--panel-h` restaba una estimación fija (`12rem`) que intentaba cubrir
  nav + pestañas + hueco a ojo.
- **`--panel-h` bajó de `calc(100vh - 12rem)` a `calc(100vh - 8rem)`** — ya no hay que
  restar el alto de `.tabs` dos veces (antes se restaba una vez dentro de `--panel-h`
  para `.content`, y `.main` sumaba `.tabs` por encima sin tope, así que `.main`
  acababa más alto que ese presupuesto). Ahora `--panel-h` es el presupuesto total de
  la fila hero/main (nav + padding de página), y `.tabs`/`.content` se lo reparten
  solos dentro de `.main`.
- **Móvil**: `.main` gana `height: auto` en el breakpoint existente (`.hero` ya volvía
  a `height: auto` ahí) y `.content` pasa de `max-height:none` a `flex: none` (ya no
  hay `max-height` que anular, ahora es `flex: 1` lo que se desactiva).

**Verificado**: Vite compila sin errores tras los edits. **No verificado a ojo en
navegador** — mismo hueco de `claude-in-chrome` de siempre; el ajuste de `8rem` en
`--panel-h` es una estimación (nav + padding de página) que David debería confirmar,
igual que el `12rem` anterior lo fue.

### Deshecho el reordenamiento — solo scroll interno hacia la cabecera — HECHO 2026-08-18

David probó el reordenamiento animado (sección abierta sube al principio, ver sección
anterior) y pidió deshacerlo: en vez de mover la sección visualmente, que sea el
scroll interno de `.content` el que se desplace para dejar la cabecera de la sección
recién abierta arriba del todo — más simple y menos "movido" que reordenar cards.

- **Revertido por completo**: `style={{ order: ... }}` en los 7 `<section>`,
  `sectionOrder()`/`SECTION_ORDER_INDEX`/`sectionBlockClassName()` (vuelto a la
  `sectionClassName()` simple de antes), el hook `useSectionReorderFlip` (import +
  usos) y el propio fichero `hooks/useSectionReorderFlip.js` — **borrado**, no
  quedaba ningún otro importador (grep confirmado antes de borrar). CSS:
  `.sectionBlockLast` vuelto a `.sectionBlock:last-child` (ya vale otra vez, sin
  reordenamiento el DOM y el orden visual vuelven a coincidir).
- **Nuevo**: `scrollSectionIntoView(sectionRefs, key)` (función de módulo, no hook —
  no guarda estado propio, solo dispara un `scrollIntoView` con guarda de escritorio
  `matchMedia('min-width:901px')`, igual que ya hacía `scrollToSection` para las
  pestañas de arriba). Ahora se llama desde **ambos** sitios donde se abre una
  sección: `toggleCollapse` (clic en la propia cabecera de una sección — antes no
  scrolleaba nada al abrir así, solo colapsaba/expandía in situ) Y `expandSection`
  (usado por `scrollToSection`, clic en pestaña de arriba — antes tenía su propio
  bloque de scroll duplicado, ahora factorizado en la función compartida). En
  `toggleCollapse` el scroll solo se dispara si se está ABRIENDO (no al cerrar,
  comprobado con `openSection !== key` antes del `setOpenSection`).

**Verificado**: `docker compose restart frontend` limpio, sin errores; módulo de la
página sirve 200, confirmado por grep que no queda ninguna referencia a
`useSectionReorderFlip`/`sectionOrder`/`sectionBlockClassName` en el JSX. **No
verificado a ojo en navegador** — mismo hueco de `claude-in-chrome` de siempre.

### Bug encontrado por David: hacía falta un segundo clic — HECHO 2026-08-18

Al pulsar la pestaña de una sección (ej. Movimientos) con OTRA sección ya abierta, la
nueva se desplegaba pero el scroll interno no dejaba su cabecera arriba hasta un
segundo clic. Causa: `scrollSectionIntoView` usaba un único `requestAnimationFrame`
antes de calcular `scrollIntoView` — pero al abrir una sección con el acordeón de una
sola, la que estaba abierta antes se colapsa a la vez, y ese colapso anima
`grid-template-rows` durante 250ms (`.collapseWrap`, ver CSS), desplazando hacia
arriba todo lo que esté debajo mientras se encoge. Un frame (~16ms) capturaba la
posición de la sección objetivo ANTES de que ese desplazamiento terminara, así que el
scroll quedaba corto — el segundo clic "acertaba" porque para entonces ya no había
nada más animando.

Arreglado cambiando el `requestAnimationFrame` por un `setTimeout(…,
COLLAPSE_TRANSITION_MS + 20)` (270ms, la duración real de la transición de
`.collapseWrap` + margen) — se espera a que la animación de colapso de la sección
anterior termine del todo antes de calcular dónde scrollear. `COLLAPSE_TRANSITION_MS`
queda como constante junto a la función, con una nota de que debe coincidir con el
`0.25s` fijado en el CSS si algún día se cambia ahí.

**Verificado**: Vite compila sin errores tras el fix. **No verificado a ojo en
navegador** — mismo hueco de `claude-in-chrome` de siempre; el retraso de 270ms podría
notarse como un pelín lento si David lo ve demasiado perezoso, es un ajuste que
también necesita su confirmación visual.

### Scroll externo colándose — rediseño a alto exacto (sin estimaciones) — HECHO 2026-08-18

David detectó que seguía habiendo scroll de página entera (externo), pese a que el
objetivo de varias sesiones seguidas era que el único scroll fuera el interno de
`.content`. Causa raíz: `--panel-h: calc(100vh - 8rem)` era una ESTIMACIÓN del hueco
de nav+padding, pero no contaba el alto real de `.cacheBar` (el aviso de "faltan
recursos por cachear", que aparece/desaparece según el Pokémon) — cuando aparecía,
sumaba altura por encima de esa estimación y la página se pasaba de 100vh, colando
scroll externo. Cada ajuste anterior de este número (`12rem` → `8rem`) fue puro tanteo
sin poder verificar a ojo — la causa real nunca era el número en sí, era que el
enfoque (restar una cifra fija) no podía contemplar un elemento de alto variable
como `.cacheBar`.

**Rediseño para que el navegador calcule el alto exacto, sin estimaciones que
mantener**:
- **`.page` acotada de verdad**: `height: calc(100vh - 4.1rem)` (el mismo valor que
  ya usaban `.tabs`/`.hero` para su propio sticky top, asumiendo esa altura de nav) +
  `overflow: hidden` — ahora NINGUNA combinación de contenido puede producir scroll de
  página entera, se recorta en vez de desbordar (red de seguridad; en condiciones
  normales nada debería llegar a desbordar, dado el resto de la cadena de abajo).
- **`.layout` pasa de restar su propio presupuesto a `flex: 1; min-height: 0`** dentro
  de esa altura ya exacta de `.page` — reparte automáticamente "lo que sobre tras
  `.cacheBar`" (si aparece), sin adivinar su alto.
- **`.hero`/`.main` pasan de `height: var(--panel-h)` (una cifra calculada aparte) a
  `height: 100%`** — toman el alto real de la fila de `.layout` (`align-items:
  stretch`, ya el valor por defecto pero dejado explícito), que a su vez ya es exacto
  gracias al punto anterior. Los dos miden literalmente lo mismo porque comparten el
  mismo `100%` del mismo contenedor, no dos números que puedan desincronizarse.
- **`.content` sin cambios de fondo** (`flex: 1; min-height: 0; overflow-y: auto`),
  solo se actualizaron los comentarios que mencionaban `var(--panel-h)` (ya no existe).
- **Móvil** (`@media max-width:900px`): `.page` vuelve a `height:auto;
  overflow:visible` y `.layout` a `flex:none` — mismo criterio que ya tenían
  `.hero`/`.main`/`.content` ahí (scroll de página normal, sin nada acotado).

**Por qué este enfoque es más robusto que seguir ajustando la cifra**: antes había
UNA estimación (nav+padding+margen) que además tenía que adivinar el alto de
`.cacheBar`, un elemento condicional. Ahora solo queda UN número fijo en todo el
sistema (`4.1rem`, el alto del nav — estable, no cambia con el contenido de la
ficha) y todo lo demás (`.cacheBar`, `.tabs`, el propio `.content`) se resuelve con
aritmética real de flexbox en tiempo de layout, no con más cifras a mano.

**Verificado**: Vite compila sin errores tras los edits, grep confirma que no queda
ninguna referencia a `--panel-h`/`var(--panel-h)` en el CSS. **No verificado a ojo en
navegador** — mismo hueco de `claude-in-chrome` de siempre. El único número que queda
por confirmar es si `4.1rem` reproduce de verdad el alto real del nav en la pantalla
de David (viene de un valor ya asumido por `.tabs`/`.hero` en sesiones anteriores, no
medido con `claude-in-chrome` tampoco) — si aún queda un pelín de scroll externo, ese
es el sitio a mirar primero.

### Dos bugs vistos en captura tras el rediseño de alto — HECHO 2026-08-18

David mandó otra captura (`/home/david/Escritorio/capturas/a.png`, Magneton) del
resultado del ajuste anterior. Dos problemas visibles:

1. **`.hero` se estiraba pero `.content` no** — quedaba un hueco grande de fondo de
   página bajo el panel de secciones mientras el hero llegaba hasta abajo del todo.
   Causa: `.layout` es un grid con una sola fila IMPLÍCITA (`grid-auto-rows: auto` por
   defecto, sin `grid-template-rows` propio) — pese a que `.layout` ya tenía un alto
   definido (`flex: 1` dentro de `.page`, acotada al viewport), una fila implícita
   `auto` no se estira automáticamente para rellenar ese alto en todos los navegadores/
   casos de forma fiable — el hero (con más contenido "denso" en su alto natural) sí
   acababa ocupando el hueco vía su propio `height: 100%`, pero `.main` no siempre lo
   hacía a la par. Arreglado con `grid-template-rows: 1fr` explícito en `.layout` —
   fuerza la fila única a ocupar el 100% del alto ya definido, sin depender del
   comportamiento por defecto de filas `auto`. Con eso, `height: 100%` en `.hero`/
   `.main` (que ya estaba) por fin resuelve contra un alto de fila inequívoco. Reset a
   `grid-template-rows: none` en el breakpoint móvil (ahí `.layout` pasa a dos filas
   apiladas, no una sola que rellenar).
2. **La pestaña resaltada arriba no coincidía con la sección realmente desplegada**
   (captura: pestaña "Evolución" en naranja pero la que se veía con contenido abierto
   era "Descripción"). Causa: el resaltado de pestaña usaba `section` (el estado del
   scrollspy vía `IntersectionObserver`, pensado para cuando el scroll de página
   entera pasaba por todas las secciones apiladas) en vez de `openSection` (el
   acordeón). Con el diseño actual (una sola sección abierta + scroll interno que la
   deja arriba al abrirla), en cuanto se scrollea dentro de una sección larga el
   observer puede detectar la cabecera de la SIGUIENTE sección (todavía colapsada)
   entrando en su banda de activación y mover el resaltado ahí, aunque la abierta
   siga siendo la anterior. Arreglado cambiando el cálculo de `active` en las
   pestañas de `section === key` a `openSection === key` — el resaltado ahora sigue
   directamente al acordeón, no a una heurística de scroll pensada para un diseño
   anterior. `section`/el `IntersectionObserver` no se tocaron más allá de esto: siguen
   haciendo falta para la conmutación de vista en móvil (`.sectionInactiveMobile`,
   qué sección se MUESTRA ahí, un problema distinto del resaltado de pestaña en
   escritorio).

**Verificado**: Vite compila sin errores tras ambos fixes, probado contra `/ficha/82`
(Magneton, el mismo Pokémon de la captura de David). **No verificado a ojo en
navegador** — mismo hueco de `claude-in-chrome` de siempre.

### David reportó que seguía igual + `.tabs` solapando `.content` — HECHO 2026-08-18

David insistió en que la captura seguía igual tras el fix anterior y añadió un bug
nuevo: `.tabs` se veía por ENCIMA de `.content` (solapados). Antes de tocar nada,
Claude verificó algo concreto en vez de asumir: David pegó el `view-source` completo
de la página, y el `<style data-vite-dev-id=".../PokemonFichaPage.module.css">` que
su navegador tenía cargado **ya incluía** el fix anterior (`grid-template-rows: 1fr`,
`height: 100%` en `.hero`/`.main`) — descartado que fuera un problema de HMR
desincronizado, el navegador sí tenía la CSS nueva.

**Diagnóstico y arreglo**: sospecha directa sobre `position: sticky` en `.tabs`
(`top: 4.1rem`) y `.hero` (`top: 5.5rem`) — ambos calibrados para una época en la que
la página SÍ hacía scroll completo; con el rediseño a "scroll solo interno en
`.content`" (sesión anterior) esos offsets ya no tenían un contexto de scroll real al
que engancharse (`.page` tiene `overflow: hidden` pero nunca se scrollea de verdad), y
es un patrón clásico de bug de `position: sticky` que un elemento acabe
mal-posicionado/solapado cuando su ancestro de scroll de referencia deja de coincidir
con el que tenía en mente el offset. **Quitado `position: sticky`/`top`/`z-index` de
ambos** — ya no aportan nada (nada hace scroll a su alrededor) y eran el principal
sospechoso del solape. `.tabs` gana `flex-shrink: 0` (nunca debe encogerse, es
`.content` quien debe absorber cualquier apretón de espacio). De paso, `.hero`/`.main`
ganan `min-height: 0` (les faltaba — un grid item sin esto puede forzar la fila a
crecer más de lo que pide `1fr` por el tamaño mínimo automático de su contenido,
sospecha secundaria).

**Lo que NO se tocó**: el `position: sticky` de `.moveTable th` (cabecera de la tabla
de Movimientos) se dejó igual — ese sí sigue siendo válido, `.content` es un ancestro
de scroll REAL (`overflow-y: auto` de verdad), no como `.page`.

**Verificado**: Vite compila sin errores, grep confirma que solo queda un
`position: sticky` en todo el fichero (el de `.moveTable th`, intencional). **No
verificado a ojo en navegador todavía** — David debe confirmar si esto resuelve el
solape y si el scroll vertical no deseado desaparece. Si sigue habiendo problemas
después de este cambio, el patrón de "adivinar CSS sin poder verlo" ha llegado a su
límite en esta sesión — la vía a seguir sería pedirle a David que conecte
`claude-in-chrome` (sigue sin estar disponible pese a varios intentos en esta y
sesiones anteriores) en vez de seguir iterando a ciegas.

### El sticky NO era la causa — fallo estructural real encontrado — HECHO 2026-08-18

Quitar el `position: sticky` (sección anterior) **no arregló nada** — David: "el
scroll sigue ahí. de verdad eres incapaz de encontrar la causa??". David instaló
`claude-in-chrome` a media conversación pero **seguía sin aparecer como herramienta
disponible** (necesita reinicio de sesión para registrarse, igual que los plugins de
`frontend-design`/`superdesign` en su momento — pendiente para la próxima sesión en
esta máquina). Sin poder verlo, Claude paró de parchear síntomas y repensó la cadena
de layout entera desde cero, a mano, con aritmética CSS real:

**Causa raíz encontrada**: `.page` tenía `height: calc(100vh - 4.1rem)` fijo (de la
sesión "scroll externo colándose"), pero ese `4.1rem` es una ESTIMACIÓN del alto real
del nav de la app — y `.page` es hijo de `.main` de `App.module.css`
(`flex: 1; display: flex`, **sin ningún `overflow`**). En cuanto la estimación se
desvía del alto real aunque sea un poco, `.page` (con un alto FIJO, no un máximo) se
pasa del hueco que le da ese contenedor flex, y como nada lo frena, el documento
entero se desborda → scroll externo persistente. Cualquier reajuste del número
(`12rem` → `8rem` → `4.1rem` en las sesiones anteriores) solo movía el problema, nunca
lo resolvía de raíz, porque el diseño en sí exigía adivinar una cifra a la perfección
para no romperse — y encima el "solape de `.tabs` sobre `.content`" que David vio era
casi con toda seguridad un síntoma DERIVADO de este mismo desbordamiento (contenido
empujado/mal medido), no un bug de `position: sticky` en sí — de ahí que quitar sticky
no arreglara nada.

**Rediseño sin ninguna cifra que adivinar**:
- **`.page`**: quitados `height`/`overflow` por completo. Vuelve a ser un bloque
  normal sin alto propio, igual que `PokemonListPage`/`ItemsListPage` — si en algún
  caso extremo el contenido no cupiera, la página scrollearía normal (como hacía
  antes de toda esta sub-saga), en vez de arriesgarse a desbordar un contenedor sin
  frenos por una estimación mal calibrada.
- **`.layout`**: quitados `flex: 1`, `min-height: 0` y el `grid-template-rows: 1fr`
  explícito. Vuelve al comportamiento NATIVO de CSS Grid: una fila implícita `auto`
  con `align-items: stretch` (ya es el valor por defecto, se dejó explícito) hace que
  `.hero` y `.main` — NINGUNO de los dos con alto propio ahora — midan automáticamente
  lo mismo (el más alto de los dos manda, el otro se estira). Esto consigue "el hero
  mide lo mismo que `.main`" (el pedido original de David) SIN fijar ningún número en
  ningún sitio — es el patrón de Grid mejor probado para "igualar el alto de dos
  columnas", en vez de reconstruirlo a mano con alturas explícitas encadenadas.
- **`.hero`/`.main`**: quitado `height: 100%` de ambos (ya no hace falta, lo resuelve
  el stretch de arriba).
- **`.content`**: vuelve a `max-height: calc(100vh - 14rem)` en vez de `flex: 1`
  dependiendo de que `.main` tuviera un alto exacto. Esta cifra sigue siendo una
  estimación, pero ahora es de BAJO RIESGO: si se queda corta o larga, lo peor que
  pasa es que la barra de scroll interna de `.content` aparece un poco antes o después
  de lo ideal — nunca que la página entera se desborde, porque ya no hay ninguna
  cadena de alturas exactas que dependa de ella.
- Limpiados los `@media (max-width:900px)` que ya no hacían falta (`.hero`/`.main` ya
  no tienen alto propio en desktop que anular en móvil).

**Verificado**: Vite compila sin errores (`docker compose restart frontend` limpio).
**Seguimos sin poder verlo a ojo** — `claude-in-chrome` instalado por David pero no
disponible todavía en esta sesión (necesita reinicio). **Cuando se retome esta
página en una sesión nueva, comprobar primero si `claude-in-chrome` ya está
disponible** — sería la primera vez en toda la vida de este proyecto que se puede
verificar un cambio visual a ojo en vez de a ciegas, y esta página en concreto lo
necesita más que ninguna otra dado el historial de esta sesión.
