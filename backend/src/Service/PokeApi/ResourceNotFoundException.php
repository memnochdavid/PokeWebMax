<?php

namespace App\Service\PokeApi;

class ResourceNotFoundException extends \RuntimeException
{
    public function __construct(string $resourceType, string $idOrName)
    {
        parent::__construct(sprintf('No se encontró "%s" en el recurso "%s" de PokeAPI.', $idOrName, $resourceType));
    }
}
