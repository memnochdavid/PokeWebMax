<?php

namespace App\Service\PokeApi;

use App\Entity\PokemonCache;

class PokemonCacheMapper
{
    public function map(array $pokemon, array $species, ?PokemonCache $existing = null): PokemonCache
    {
        $entity = $existing ?? new PokemonCache($pokemon['id']);

        $entity->setName($pokemon['name']);
        $entity->setSpriteUrl(
            $pokemon['sprites']['other']['official-artwork']['front_default']
                ?? $pokemon['sprites']['front_default']
                ?? null
        );
        $entity->setTypes(array_map(
            static fn (array $entry) => $entry['type']['name'],
            $pokemon['types']
        ));
        $entity->setColorName($species['color']['name'] ?? null);
        $entity->setGenerationId($this->extractIdFromUrl($species['generation']['url'] ?? ''));
        $entity->setFetchedAt(new \DateTimeImmutable());

        return $entity;
    }

    private function extractIdFromUrl(string $url): int
    {
        $segments = array_values(array_filter(explode('/', rtrim($url, '/'))));

        return (int) end($segments);
    }
}
