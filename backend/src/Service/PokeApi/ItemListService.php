<?php

namespace App\Service\PokeApi;

use App\Repository\PokeApiResourceCacheRepository;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

/**
 * Listado específico de objetos — a diferencia de PokeApiListService (genérico por
 * resourceType), añade categoría/pocket/coste para que el frontend pueda filtrar sin
 * cargar los ~2200 payloads completos (efecto/descripción/game_indices no hacen falta
 * en la lista). Mismo criterio que PokemonListService.
 */
class ItemListService
{
    // Idiomas que ofrece el selector de idioma del frontend (LanguageContext.jsx) —
    // mismo criterio que PokemonListService.
    private const SUPPORTED_LANGUAGES = ['es', 'en'];

    // Mismo motivo que PokemonListService::LIST_CACHE_TTL_SECONDS: recorrer `machine`
    // (2372 filas) + `item`/`move` para nombres localizados en cada carga de /objetos
    // es caro y apenas cambia entre sesiones — se cachea el resultado ya computado.
    private const LIST_CACHE_TTL_SECONDS = 300;

    public function __construct(
        private readonly PokeApiClient $pokeApiClient,
        private readonly PokeApiResourceCacheRepository $repository,
        private readonly CacheInterface $cache,
    ) {
    }

    /**
     * @return array<int, array{
     *     id: int, name: string, cached: bool, fetchedAt: ?string,
     *     names: array<string, string>, category: ?string, pocket: ?string, cost: ?int,
     *     move: ?array{name: string, names: array<string, string>},
     * }>
     */
    public function listAll(): array
    {
        return $this->cache->get(
            'item_list_all',
            function (ItemInterface $item) {
                $item->expiresAfter(self::LIST_CACHE_TTL_SECONDS);

                return $this->computeListAll();
            },
        );
    }

    /**
     * @return array<int, array{
     *     id: int, name: string, cached: bool, fetchedAt: ?string,
     *     names: array<string, string>, category: ?string, pocket: ?string, cost: ?int,
     *     move: ?array{name: string, names: array<string, string>},
     * }>
     */
    private function computeListAll(): array
    {
        $entries = $this->pokeApiClient->fetchResourceList('item');
        $cachedFetchedAt = $this->repository->findFetchedAtByType('item');
        $summaries = $this->repository->findItemSummaries();
        $pocketsByCategory = $this->repository->findItemCategoryPockets();
        $namesById = $this->repository->findLocalizedNamesByType('item', self::SUPPORTED_LANGUAGES);
        // MT/MO/DT: qué movimiento enseñan, para mostrarlo en su card (no viene en
        // `item`, hay que cruzarlo con `machine` — ver findMachineMoveNamesByItem).
        $moveByItem = $this->repository->findMachineMoveNamesByItem();
        $moveNames = $this->repository->findLocalizedNamesByTypeIndexedBySlug('move', self::SUPPORTED_LANGUAGES);

        return array_map(
            function (array $entry) use ($cachedFetchedAt, $summaries, $pocketsByCategory, $namesById, $moveByItem, $moveNames) {
                $fetchedAt = $cachedFetchedAt[$entry['id']] ?? null;
                $summary = $summaries[$entry['name']] ?? null;
                $category = $summary['category'] ?? null;
                $moveName = $moveByItem[$entry['name']] ?? null;

                return [
                    'id' => $entry['id'],
                    'name' => $entry['name'],
                    'cached' => $fetchedAt !== null,
                    'fetchedAt' => $fetchedAt?->format(DATE_ATOM),
                    'names' => $namesById[$entry['id']] ?? [],
                    'category' => $category,
                    'pocket' => $category !== null ? ($pocketsByCategory[$category] ?? null) : null,
                    'cost' => $summary['cost'] ?? null,
                    'move' => $moveName !== null
                        ? ['name' => $moveName, 'names' => $moveNames[$moveName] ?? []]
                        : null,
                ];
            },
            $entries,
        );
    }
}
