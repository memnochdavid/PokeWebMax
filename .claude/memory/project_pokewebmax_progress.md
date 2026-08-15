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
- Repo git **NO inicializado todavía** — a diferencia de ZenPaw, aquí no se ha hecho
  `git init` ni se ha pedido. No lo hagas sin que lo pida explícitamente.

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

## Pendiente / siguiente paso natural

David quiere empezar por una función de **cacheo manual** desde PokeAPI v2 hacia la BD de
Symfony (a diferencia del Android, que cachea automáticamente). Aún no se ha diseñado ni
la entidad ni el comando/endpoint — es el siguiente paso a discutir con él, no asumir
forma concreta todavía.
