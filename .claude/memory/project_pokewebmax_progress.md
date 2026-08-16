---
name: project_pokewebmax_progress
description: Estado de avance de PokeWebMax — qué está montado y qué falta. Actualizar cada sesión.
metadata:
  type: project
---

Última actualización: 2026-08-16.

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
