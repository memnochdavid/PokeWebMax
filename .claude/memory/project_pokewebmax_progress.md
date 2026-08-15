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

## Cacheo manual de PokeAPI (v1) — HECHO 2026-08-15

Implementado y probado end-to-end (pikachu, charizard, y caso de error con nombre
inexistente):

- `symfony/http-client` instalado.
- Entidad `App\Entity\PokemonCache` (tabla `pokemon_cache`): `id` (el id de PokeAPI, no
  autoincrement), `name`, `spriteUrl`, `types` (columna JSON), `colorName`,
  `generationId`, `fetchedAt`. **No incluye `evoChainLength`** — se dejó fuera de v1
  deliberadamente (requeriría una 3ª llamada a `evolution-chain`), se añadirá cuando haga
  falta de verdad.
- `App\Service\PokeApi\PokeApiClient` — envuelve `HttpClientInterface`, dos métodos:
  `fetchPokemon()` y `fetchSpecies()`, ambos contra PokeAPI v2. 404 → lanza
  `PokemonNotFoundException` propia.
- `App\Service\PokeApi\PokemonCacheMapper` — mapea el JSON crudo de `pokemon` +
  `pokemon-species` a la entidad (upsert: recibe la entidad existente o crea una nueva).
- `App\Command\CachePokemonCommand` (`app:cache:pokemon {idOrName}`) — disparador manual
  por consola (el primero que existió; luego se añadió también el endpoint HTTP, ver
  sección siguiente). Upsert por id, maneja 404 y errores de red con `Command::FAILURE`
  en vez de excepción sin capturar.
- Migración `Version20260815104132` aplicada.

## Vista de cacheo desde el frontend — HECHO 2026-08-15

- Lógica compartida extraída a `App\Service\PokeApi\PokemonCacheService::cache()`
  (devuelve `PokemonCacheResult { entity, wasCached }`). El comando `app:cache:pokemon` se
  refactorizó para usarlo — ya no duplica lógica.
- Nuevo endpoint `POST /api/pokemon/cache/{idOrName}` (`PokemonCacheController`). 404 si
  no existe en PokeAPI, 502 si PokeAPI no responde. Devuelve el Pokémon cacheado en JSON.
- Frontend: se introdujo **routing** (`react-router-dom`, `BrowserRouter` en `main.jsx`).
  `App.jsx` pasó a ser el shell de navegación (nav + `<Routes>`), ya no contiene la vista
  de estado directamente.
  - `pages/StatusPage/` — la vista de salud que antes vivía en `App.jsx`, movida tal cual.
  - `pages/CachePokemonPage/` — vista nueva: formulario (input + submit) que llama al
    endpoint, muestra sprite/nombre/tipos o el error. Toda la lógica de estado/petición
    vive en `hooks/useCachePokemon.js` (incluyendo el propio valor del input) — el
    componente es JSX puro, según `[[project_pokewebmax_architecture_decisions]]` punto 7.

## Pendiente / siguiente paso natural

- `evoChainLength` y datos de "ficha completa" (stats, habilidades, movimientos) quedan
  fuera de esta v1.
- Cacheo por lotes/rango (ej. una generación entera) fue descartado para v1 a propósito,
  podría ser una iteración futura.
- No hay endpoint de **lectura/listado** todavía (`GET /api/pokemon`) — solo se puede
  cachear uno a uno y ver el resultado puntual devuelto por la propia petición POST. Ver
  la tabla completa hoy solo es posible por SQL directo o `bin/console`.
