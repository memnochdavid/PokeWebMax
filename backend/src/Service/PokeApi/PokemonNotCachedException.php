<?php

namespace App\Service\PokeApi;

class PokemonNotCachedException extends \RuntimeException
{
    public function __construct(string $idOrName)
    {
        parent::__construct(sprintf('El Pokémon "%s" no está cacheado todavía. Cachéalo primero desde /cache.', $idOrName));
    }
}
