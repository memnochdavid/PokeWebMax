<?php

namespace App\Service\PokeApi;

final readonly class PokeApiCacheBatchResult
{
    public function __construct(
        public int $cached,
        public int $alreadyCached,
        public int $failed,
    ) {
    }
}
