<?php

namespace App\Service\PokeApi;

class ItemNotCachedException extends \RuntimeException
{
    public function __construct(string $idOrName)
    {
        parent::__construct(sprintf('El objeto "%s" no está cacheado todavía. Cachéalo primero desde /cache.', $idOrName));
    }
}
