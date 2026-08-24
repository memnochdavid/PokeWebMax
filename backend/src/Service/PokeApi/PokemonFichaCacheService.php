<?php

namespace App\Service\PokeApi;

use App\Repository\PokeApiResourceCacheRepository;

class PokemonFichaCacheService
{
    public function __construct(
        private readonly PokeApiCacheService $cacheService,
        private readonly PokeApiResourceCacheRepository $repository,
    ) {
    }

    /**
     * Cachea de un tirón todo lo que le falte a la ficha de un Pokémon (species,
     * evolution-chain, moves, abilities, forms) — el botón "Cachear todo lo que falta"
     * de la ficha. Cada pieza pasa por PokeApiCacheService::cache(), que ya es
     * idempotente (no repite el fetch si ya está cacheada), así que no hace falta
     * calcular antes qué falta exactamente: simplemente se piden todas las piezas
     * referenciadas por el Pokémon y las que ya estaban cacheadas no cuestan una
     * petición HTTP.
     *
     * @throws PokemonNotCachedException si el propio Pokémon no está cacheado
     * @throws \Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface
     */
    public function cacheMissing(string $idOrName): void
    {
        $pokemon = $this->repository->findPokemonWithSpeciesFallback($idOrName);
        if ($pokemon === null) {
            throw new PokemonNotCachedException($idOrName);
        }

        $payload = $pokemon->getPayload();

        $speciesUrl = $payload['species']['url'] ?? null;
        if ($speciesUrl !== null) {
            $species = $this->cacheService->cache('pokemon-species', (string) PokeApiUrl::idFromUrl($speciesUrl))->entity;

            $evolutionChainUrl = $species->getPayload()['evolution_chain']['url'] ?? null;
            if ($evolutionChainUrl !== null) {
                $this->cacheService->cache('evolution-chain', (string) PokeApiUrl::idFromUrl($evolutionChainUrl));
            }
        }

        foreach (array_column($payload['moves'] ?? [], 'move') as $move) {
            $this->cacheService->cache('move', (string) PokeApiUrl::idFromUrl($move['url']));
        }

        foreach (array_column($payload['abilities'] ?? [], 'ability') as $ability) {
            $this->cacheService->cache('ability', (string) PokeApiUrl::idFromUrl($ability['url']));
        }

        foreach ($payload['forms'] ?? [] as $form) {
            $this->cacheService->cache('pokemon-form', (string) PokeApiUrl::idFromUrl($form['url']));
        }
    }
}
