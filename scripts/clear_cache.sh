#!/bin/bash
cd "$(dirname "$0")/.."

docker compose exec backend rm -rf var/cache/dev var/cache/prod
docker compose exec backend php bin/console cache:clear
echo "✅ Caché limpiada."
