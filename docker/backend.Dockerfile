FROM php:8.4-cli

RUN apt-get update && apt-get install -y \
    $PHPIZE_DEPS \
    git unzip libicu-dev libzip-dev libonig-dev \
    && docker-php-ext-install pdo pdo_mysql intl zip mbstring \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
EXPOSE 8000
CMD ["php", "-S", "0.0.0.0:8000", "-t", "public"]
