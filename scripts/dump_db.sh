#!/bin/bash
cd "$(dirname "$0")/.."

# Vuelca la base de datos MariaDB completa (incluida la caché de PokeAPI) a un único
# archivo fijo, backup/pokewebmax.sql.gz — se SOBRESCRIBE en cada ejecución, no se
# versiona por fecha. Gitignorado (backup/ en .gitignore): David lo pasa a mano entre
# máquinas/equipos, no viaja con el repo (ver scripts/restore_db.sh para restaurarlo).

set -e

DUMP_DIR="backup"
DUMP_FILE="$DUMP_DIR/pokewebmax.sql.gz"

mkdir -p "$DUMP_DIR"

echo "🗄️  Volcando base de datos 'pokewebmax'..."
docker compose exec -T database mariadb-dump -u pokewebmax -ppokewebmax pokewebmax | gzip > "$DUMP_FILE"

echo "✅ Dump guardado en $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"
