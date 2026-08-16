<?php

namespace App\Service\PokeApi;

final class PokeApiUrl
{
    public static function idFromUrl(string $url): int
    {
        $segments = array_values(array_filter(explode('/', rtrim($url, '/'))));

        return (int) end($segments);
    }
}
