#!/bin/bash
cd "$(dirname "$0")/.."

# Restaura la base de datos MariaDB desde un dump hecho con dump_db.sh (.sql o
# .sql.gz). Sin argumento, coge el más reciente de backend/var/dumps/. BORRA la base
# de datos 'pokewebmax' entera (DROP DATABASE) y la recrea vacía antes de cargar el
# dump — no es un simple sobrescrito tabla por tabla, así que no deja restos de tablas
# que existan ahora mismo pero no estén en el backup. Pide confirmación salvo que se
# pase -f/--force.
#
# Uso:
#   bash scripts/restore_db.sh                              # el dump más reciente
#   bash scripts/restore_db.sh backend/var/dumps/foo.sql.gz  # uno concreto
#   bash scripts/restore_db.sh -f backend/var/dumps/foo.sql  # sin confirmar

set -e

FORCE=0
if [ "$1" = "-f" ] || [ "$1" = "--force" ]; then
    FORCE=1
    shift
fi

DUMP_FILE="$1"
if [ -z "$DUMP_FILE" ]; then
    DUMP_FILE="$(ls -t backend/var/dumps/*.sql.gz backend/var/dumps/*.sql 2>/dev/null | head -n 1)"
    if [ -z "$DUMP_FILE" ]; then
        echo "❌ No hay ningún dump en backend/var/dumps/ y no se ha indicado un archivo."
        exit 1
    fi
    echo "ℹ️  Ningún archivo indicado, usando el más reciente: $DUMP_FILE"
fi

if [ ! -f "$DUMP_FILE" ]; then
    echo "❌ No existe el archivo: $DUMP_FILE"
    exit 1
fi

if [ "$FORCE" -ne 1 ]; then
    echo "⚠️  Esto BORRA POR COMPLETO la base de datos 'pokewebmax' actual (DROP DATABASE)"
    echo "   y la recrea desde: $DUMP_FILE"
    read -r -p "¿Continuar? [y/N] " CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        echo "Cancelado."
        exit 1
    fi
fi

echo "🧨 Borrando y recreando 'pokewebmax' desde cero (no un simple sobrescrito de tablas)..."
docker compose exec -T database mariadb -u root -proot \
    -e "DROP DATABASE IF EXISTS pokewebmax; CREATE DATABASE pokewebmax CHARACTER SET utf8mb4;"

echo "🗄️  Restaurando '$DUMP_FILE'..."
if [[ "$DUMP_FILE" == *.gz ]]; then
    gunzip -c "$DUMP_FILE" | docker compose exec -T database mariadb -u pokewebmax -ppokewebmax pokewebmax
else
    docker compose exec -T database mariadb -u pokewebmax -ppokewebmax pokewebmax < "$DUMP_FILE"
fi

echo "✅ Base de datos restaurada."
