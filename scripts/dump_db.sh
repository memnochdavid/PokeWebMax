#!/bin/bash
cd "$(dirname "$0")/.."

# Vuelca la base de datos MariaDB completa (incluida la caché de PokeAPI) a un .sql.gz
# con marca de tiempo en backend/var/dumps/ (gitignorado vía backend/.gitignore, /var/
# — nunca se sube al repo). Útil antes de una migración arriesgada o para llevarte una
# copia de lo ya cacheado a otra máquina.

set -e

DUMP_DIR="backend/var/dumps"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_FILE="$DUMP_DIR/pokewebmax_${TIMESTAMP}.sql.gz"

mkdir -p "$DUMP_DIR"

echo "🗄️  Volcando base de datos 'pokewebmax'..."
docker compose exec -T database mariadb-dump -u pokewebmax -ppokewebmax pokewebmax | gzip > "$DUMP_FILE"

echo "✅ Dump guardado en $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"
