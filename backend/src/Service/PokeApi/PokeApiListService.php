<?php

namespace App\Service\PokeApi;

use App\Repository\PokeApiResourceCacheRepository;

class PokeApiListService
{
    public function __construct(
        private readonly PokeApiClient $pokeApiClient,
        private readonly PokeApiResourceCacheRepository $repository,
    ) {
    }

    /**
     * Todo lo que existe de un recurso según PokeAPI, marcando qué está ya cacheado
     * localmente. Respuesta deliberadamente ligera (sin el payload completo) porque
     * algunos recursos tienen miles de entradas (item, pokemon-form...).
     *
     * @return array<int, array{id: int, name: string, cached: bool, fetchedAt: ?string}>
     */
    public function listAll(string $resourceType): array
    {
        $entries = $this->pokeApiClient->fetchResourceList($resourceType);
        $cachedFetchedAt = $this->repository->findFetchedAtByType($resourceType);

        return array_map(
            function (array $entry) use ($cachedFetchedAt) {
                $fetchedAt = $cachedFetchedAt[$entry['id']] ?? null;

                return [
                    'id' => $entry['id'],
                    'name' => $entry['name'],
                    'cached' => $fetchedAt !== null,
                    'fetchedAt' => $fetchedAt?->format(DATE_ATOM),
                ];
            },
            $entries,
        );
    }
}
