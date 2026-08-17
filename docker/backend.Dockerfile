FROM php:8.4-cli

RUN apt-get update && apt-get install -y \
    $PHPIZE_DEPS \
    git unzip libicu-dev libzip-dev libonig-dev \
    && docker-php-ext-install pdo pdo_mysql intl zip mbstring \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
EXPOSE 8000
# 128M (default de PHP) no basta para la ficha de Pokémon con el payload `pokemon` más
# grande del dataset (Mew, ~700KB en bruto por su lista de movimientos descomunal —
# puede aprender casi cualquier movimiento por evento/MT/tutor en distintos juegos) una
# vez el profiler de Symfony en modo dev clona la respuesta para el toolbar de depuración.
CMD ["php", "-d", "memory_limit=512M", "-S", "0.0.0.0:8000", "-t", "public"]
