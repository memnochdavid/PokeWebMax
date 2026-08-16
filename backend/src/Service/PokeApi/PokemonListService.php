<?php

namespace App\Service\PokeApi;

use App\Repository\PokeApiResourceCacheRepository;

/**
 * Listado específico de Pokémon — a diferencia de PokeApiListService (genérico por
 * resourceType), este añade los tipos de cada Pokémon cruzando con el recurso
 * `pokemon` cacheado, algo que `pokemon-species` no tiene y que la card de la lista
 * necesita para el degradado de color. Asume que el id de `pokemon-species` coincide
 * con el de su variante por defecto en `pokemon` — cierto para las ~1025 especies
 * base; no se usa aquí para formas especiales, que no se listan en esta vista.
 */
class PokemonListService
{
    public function __construct(
        private readonly PokeApiClient $pokeApiClient,
        private readonly PokeApiResourceCacheRepository $repository,
    ) {
    }

    /**
     * @return array<int, array{id: int, name: string, cached: bool, fetchedAt: ?string, types: string[]}>
     */
    public function listAll(): array
    {
        $entries = $this->pokeApiClient->fetchResourceList('pokemon-species');
        $cachedFetchedAt = $this->repository->findFetchedAtByType('pokemon-species');
        $typesById = $this->repository->findPokemonTypesById();

        return array_map(
            function (array $entry) use ($cachedFetchedAt, $typesById) {
                $fetchedAt = $cachedFetchedAt[$entry['id']] ?? null;

                return [
                    'id' => $entry['id'],
                    'name' => $entry['name'],
                    'cached' => $fetchedAt !== null,
                    'fetchedAt' => $fetchedAt?->format(DATE_ATOM),
                    'types' => $typesById[$entry['id']] ?? [],
                ];
            },
            $entries,
        );
    }
}
