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
