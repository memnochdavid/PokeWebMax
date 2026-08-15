#!/bin/bash
cd "$(dirname "$0")/.."

# Genera una nueva migración a partir del diff entre las entidades Doctrine y el
# esquema actual de la BD. Úsalo tras crear/modificar una entidad.
# No aplica nada: solo crea el archivo en backend/migrations/. Revísalo y luego
# aplícalo con ./scripts/migrate.sh.

set -e

echo "🧬 Generando nueva migración Doctrine (diff contra la BD)..."
docker compose exec backend php bin/console doctrine:migrations:diff --no-interaction

echo ""
echo "✅ Archivo creado en backend/migrations/. Revísalo antes de aplicarlo."
echo "💡 Si el diff está vacío, el esquema ya está sincronizado con las entidades."
echo "💡 Para aplicar: ./scripts/migrate.sh"
