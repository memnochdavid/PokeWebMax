<?php

namespace App\Service\PokeApi;

use App\Entity\PokemonCache;

final readonly class PokemonCacheResult
{
    public function __construct(
        public PokemonCache $entity,
        public bool $wasCached,
    ) {
    }
}
