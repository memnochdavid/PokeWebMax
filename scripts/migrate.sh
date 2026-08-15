#!/bin/bash
cd "$(dirname "$0")/.."

# Aplica todas las migraciones Doctrine pendientes y limpia la caché.
# Úsalo tras generar una migración con ./make_migration.sh o tras un git pull con
# migraciones nuevas.

set -e

echo "🗂  Estado de migraciones actual:"
docker compose exec backend php bin/console doctrine:migrations:status 2>/dev/null | grep -E "Executed|Available|New|Not migrated" || true

echo ""
echo "🚀 Aplicando migraciones pendientes..."
docker compose exec backend php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

echo ""
echo "🧹 Limpiando caché..."
docker compose exec backend php bin/console cache:clear

echo ""
echo "✅ Migraciones aplicadas."
