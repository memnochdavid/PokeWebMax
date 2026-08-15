---
name: project_pokewebmax_progress
description: Estado de avance de PokeWebMax — qué está montado y qué falta. Actualizar cada sesión.
metadata:
  type: project
---

Última actualización: 2026-08-15.

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
