<?php

namespace App\Service\PokeApi;

class PokemonNotFoundException extends \RuntimeException
{
    public function __construct(string $idOrName)
    {
        parent::__construct(sprintf('No se encontró el Pokémon "%s" en PokeAPI.', $idOrName));
    }
}
