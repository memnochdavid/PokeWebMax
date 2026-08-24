#!/bin/bash
cd "$(dirname "$0")/.."

# Reimporta las descripciones Pokédex de WikiDex (fallback de flavor text en español):
# 1) exporta wikidex.sqlite -> backend/var/wikidex_import/flavor_text.json (Python, host)
# 2) cruza cada título con la especie de PokeAPI ya cacheada y hace upsert en
#    wikidex_flavor_text (comando Symfony, dentro del contenedor backend).
# Re-ejecutable: el paso 2 es upsert por (pokemon_species_id, version_slug), no duplica.
# Requiere que scripts/wikidex_dump/wikidex.sqlite exista (ver dump_wikidex.py) y que
# pokeapi_resource_cache ya tenga las pokemon-species cacheadas (si no, ese título se
# reporta como "sin especie correspondiente", no falla el import entero).

set -e

echo "🐍 Exportando descripciones desde wikidex.sqlite..."
python3 scripts/wikidex_export_flavor_text.py

echo ""
echo "📥 Importando a MariaDB (wikidex_flavor_text)..."
# memory_limit alto: el import hace ~17k INSERT/UPDATE en un solo flush y el profiler
# de Doctrine en modo dev guarda backtrace de cada query, agotando los 128M por defecto.
docker compose exec backend php -d memory_limit=768M bin/console app:wikidex:import

echo ""
echo "🐍 Exportando descripciones de Megaevolución/Gigamax..."
python3 scripts/wikidex_export_variety_descriptions.py

echo ""
echo "📥 Importando a MariaDB (wikidex_variety_flavor_text)..."
docker compose exec backend php -d memory_limit=768M bin/console app:wikidex:import-varieties

echo ""
echo "✅ Importación completa."
