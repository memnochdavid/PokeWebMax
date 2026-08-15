<?php

namespace App\Service\PokeApi;

use App\Entity\PokeApiResourceCache;

final readonly class PokeApiCacheResult
{
    public function __construct(
        public PokeApiResourceCache $entity,
        public bool $alreadyCached,
    ) {
    }
}
