<?php

namespace App\Service\PokeApi;

use App\Entity\PokeApiResourceCache;
use App\Repository\PokeApiResourceCacheRepository;

class PokemonFichaAssembler
{
    public function __construct(private readonly PokeApiResourceCacheRepository $repository)
    {
    }

    /**
     * Compone la ficha completa de un Pokémon a partir de lo que ya está cacheado
     * localmente (pokemon, pokemon-species, evolution-chain, moves, abilities, forms).
     * No dispara ningún fetch a PokeAPI ni cachea nada nuevo — el cacheo es siempre una
     * acción explícita del usuario (ver PokemonFichaCacheService). Cada pieza no
     * cacheada se devuelve como `null`/`cached: false` y se resume en `missing` para
     * que el frontend marque qué sección tiene datos pendientes de cachear.
     *
     * @throws PokemonNotCachedException si el propio Pokémon no está cacheado
     */
    public function assemble(string $idOrName): array
    {
        $pokemon = $this->repository->findByTypeAndIdOrName('pokemon', $idOrName);
        if ($pokemon === null) {
            throw new PokemonNotCachedException($idOrName);
        }

        $payload = $pokemon->getPayload();

        $species = $this->resolveOne('pokemon-species', $payload['species']['url'] ?? null);
        $evolutionChain = $species !== null
            ? $this->resolveOne('evolution-chain', $species->getPayload()['evolution_chain']['url'] ?? null)
            : null;
        $moves = $this->resolveMany('move', array_column($payload['moves'] ?? [], 'move'));
        $abilities = $this->resolveMany('ability', array_column($payload['abilities'] ?? [], 'ability'));
        $forms = $this->resolveMany('pokemon-form', $payload['forms'] ?? []);

        return [
            'pokemon' => $payload,
            'species' => $species?->getPayload(),
            'evolutionChain' => $evolutionChain?->getPayload(),
            'moves' => $moves,
            'abilities' => $abilities,
            'forms' => $forms,
            'missing' => [
                'species' => $species === null,
                'evolutionChain' => $evolutionChain === null,
                'moves' => $this->countMissing($moves),
                'abilities' => $this->countMissing($abilities),
                'forms' => $this->countMissing($forms),
            ],
        ];
    }

    private function resolveOne(string $resourceType, ?string $url): ?PokeApiResourceCache
    {
        if ($url === null) {
            return null;
        }

        return $this->repository->findByTypeAndIdOrName($resourceType, (string) PokeApiUrl::idFromUrl($url));
    }

    /**
     * @param array<int, array{name: string, url: string}> $refs
     * @return array<int, array{id: int, name: string, cached: bool, payload: ?array}>
     */
    private function resolveMany(string $resourceType, array $refs): array
    {
        return array_map(function (array $ref) use ($resourceType) {
            $id = PokeApiUrl::idFromUrl($ref['url']);
            $cached = $this->repository->findByTypeAndIdOrName($resourceType, (string) $id);

            return [
                'id' => $id,
                'name' => $ref['name'],
                'cached' => $cached !== null,
                'payload' => $cached?->getPayload(),
            ];
        }, $refs);
    }

    private function countMissing(array $resolvedMany): int
    {
        return count(array_filter($resolvedMany, static fn (array $entry) => !$entry['cached']));
    }
}
