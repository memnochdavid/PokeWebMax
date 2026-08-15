#!/bin/bash
cd "$(dirname "$0")/.."

# Bootstrap completo del proyecto tras un "git clone" nuevo (o tras un pull con cambios
# gordos). Deja backend, frontend y base de datos arriba y sincronizados.
# Idempotente: puedes volver a ejecutarlo sin miedo aunque el entorno ya exista.

set -e

echo "🚀 Inicializando PokeWebMax..."

# 1. .env.local del backend (no está en git, hay que crearlo la primera vez)
if [ ! -f backend/.env.local ]; then
    echo "🔑 Creando backend/.env.local (no versionado)..."
    cat > backend/.env.local <<'EOF'
###> doctrine/doctrine-bundle ###
DATABASE_URL="mysql://pokewebmax:pokewebmax@database:3306/pokewebmax?serverVersion=11.8.8-MariaDB&charset=utf8mb4"
###< doctrine/doctrine-bundle ###
EOF
    echo "✅ backend/.env.local creado."
else
    echo "ℹ️  backend/.env.local ya existe, no lo toco."
fi

# 2. Construir imágenes
echo "🐳 Construyendo imágenes Docker..."
docker compose build backend frontend

# 3. Levantar solo la base de datos primero (backend/frontend aún no tienen
#    vendor/node_modules, fallarían si arrancan ya con su CMD por defecto)
echo "🗄️  Levantando MariaDB..."
docker compose up -d database

echo "⏳ Esperando a que MariaDB acepte conexiones..."
tries=0
until docker compose exec -T database mariadb-admin ping -upokewebmax -ppokewebmax --silent >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -ge 30 ]; then
        echo "❌ MariaDB no respondió tras 60s. Revisa: docker compose logs database"
        exit 1
    fi
    sleep 2
done
echo "✅ MariaDB lista."

# 4. Dependencias backend (vendor/ está gitignored, no existe tras un clone)
echo "📦 Instalando dependencias de Symfony (Composer)..."
docker compose run --rm backend composer install --no-interaction --optimize-autoloader

# 5. Dependencias frontend (node_modules/ está gitignored, no existe tras un clone)
echo "📦 Instalando dependencias de React (npm)..."
docker compose run --rm frontend npm install

# 6. Ahora sí, arrancar todo el stack
echo "🐳 Levantando backend y frontend..."
docker compose up -d

# 7. Base de datos + migraciones
echo "🔄 Creando base de datos (si no existe) y aplicando migraciones..."
docker compose exec backend php bin/console doctrine:database:create --if-not-exists
docker compose exec backend php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

# 8. Caché
echo "🧹 Limpiando caché de Symfony..."
docker compose exec backend php bin/console cache:clear

# Nota: no hay paso de "chown a mi usuario" aquí. Este proyecto vive en un punto de
# montaje fuseblk (NTFS) que no soporta permisos/propietario Unix reales — chown y chmod
# no dan error, pero tampoco persisten. Por eso el CMD de frontend.Dockerfile invoca vite
# vía `node node_modules/vite/bin/vite.js` en vez del shim `node_modules/.bin/vite`
# (que necesitaría el bit +x, imposible de fijar en este filesystem).

echo ""
echo "✅ ¡Proyecto listo!"
echo "👉 Frontend: http://localhost:5174"
echo "👉 Backend API: http://localhost:8001"
echo "👉 MariaDB: localhost:3307 (usuario/clave: pokewebmax/pokewebmax)"
echo ""
echo "💡 Ver logs en vivo: docker compose logs -f backend frontend"
