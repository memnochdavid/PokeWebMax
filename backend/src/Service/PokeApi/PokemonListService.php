<?php

namespace App\Service\PokeApi;

use App\Repository\PokeApiResourceCacheRepository;

/**
 * Listado específico de Pokémon — a diferencia de PokeApiListService (genérico por
 * resourceType), este añade los tipos de cada Pokémon cruzando con el recurso
 * `pokemon` cacheado, y metadatos derivados de `pokemon-species` (generación,
 * legendario/singular, formas mega/gigamax/regional, longitud de la cadena
 * evolutiva) que la vista de lista usa para paginar por generación y filtrar. Todo
 * viene de caché local ya proyectada por JSON_EXTRACT — no dispara llamadas nuevas a
 * PokeAPI salvo la lista maestra de especies (ver PokeApiClient::fetchResourceList).
 * Asume que el id de `pokemon-species` coincide con el de su variante por defecto en
 * `pokemon` — cierto para las ~1025 especies base; no se usa aquí para formas
 * especiales, que no se listan en esta vista.
 */
class PokemonListService
{
    public function __construct(
        private readonly PokeApiClient $pokeApiClient,
        private readonly PokeApiResourceCacheRepository $repository,
    ) {
    }

    /**
     * @return array<int, array{
     *     id: int, name: string, cached: bool, fetchedAt: ?string, types: string[],
     *     generation: ?int, legendary: bool, mythical: bool,
     *     hasMega: bool, hasGmax: bool, hasRegional: bool, evolutionStages: ?int,
     * }>
     */
    public function listAll(): array
    {
        $entries = $this->pokeApiClient->fetchResourceList('pokemon-species');
        $cachedFetchedAt = $this->repository->findFetchedAtByType('pokemon-species');
        $typesById = $this->repository->findPokemonTypesById();
        $speciesSummaries = $this->repository->findSpeciesSummaries();
        $chainDepths = $this->repository->findEvolutionChainDepths();

        return array_map(
            function (array $entry) use ($cachedFetchedAt, $typesById, $speciesSummaries, $chainDepths) {
                $fetchedAt = $cachedFetchedAt[$entry['id']] ?? null;
                $summary = $speciesSummaries[$entry['id']] ?? null;
                $evolutionChainId = $summary['evolutionChainId'] ?? null;

                return [
                    'id' => $entry['id'],
                    'name' => $entry['name'],
                    'cached' => $fetchedAt !== null,
                    'fetchedAt' => $fetchedAt?->format(DATE_ATOM),
                    'types' => $typesById[$entry['id']] ?? [],
                    'generation' => $summary['generation'] ?? null,
                    'legendary' => $summary['legendary'] ?? false,
                    'mythical' => $summary['mythical'] ?? false,
                    'hasMega' => $summary['hasMega'] ?? false,
                    'hasGmax' => $summary['hasGmax'] ?? false,
                    'hasRegional' => $summary['hasRegional'] ?? false,
                    'evolutionStages' => $evolutionChainId !== null ? ($chainDepths[$evolutionChainId] ?? null) : null,
                ];
            },
            $entries,
        );
    }
}
