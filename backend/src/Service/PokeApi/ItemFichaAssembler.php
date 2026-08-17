<?php

namespace App\Service\PokeApi;

use App\Repository\PokeApiResourceCacheRepository;
use App\Repository\WikidexEffectTextRepository;

/**
 * Ficha de un objeto — a diferencia de PokemonFichaAssembler no necesita resolver
 * recursos aparte (species/evolution-chain/moves...): el payload de `item` ya trae
 * todo lo necesario (names, effect_entries, flavor_text_entries, category,
 * attributes, cost, fling, game_indices, held_by_pokemon).
 */
class ItemFichaAssembler
{
    public function __construct(
        private readonly PokeApiResourceCacheRepository $repository,
        private readonly WikidexEffectTextRepository $wikidexEffectTextRepository,
    ) {
    }

    /**
     * @throws ItemNotCachedException si el objeto no está cacheado
     */
    public function assemble(string $idOrName): array
    {
        $item = $this->repository->findByTypeAndIdOrName('item', $idOrName);
        if ($item === null) {
            throw new ItemNotCachedException($idOrName);
        }

        $payload = $item->getPayload();

        // El "pocket" (bolsillo) no viene en `item`, solo en `item-category` — se
        // añade aquí ya resuelto para que el frontend no tenga que cargar ese recurso
        // aparte solo para esto (mismo cruce que ItemListService::listAll()).
        $categoryName = $payload['category']['name'] ?? null;
        $pocketsByCategory = $categoryName !== null ? $this->repository->findItemCategoryPockets() : [];
        $payload['pocket_name'] = $categoryName !== null ? ($pocketsByCategory[$categoryName] ?? null) : null;

        // MT/MO/DT: qué movimiento enseñan (no viene en `item`, hay que cruzarlo con
        // `machine` — mismo cruce que ItemListService::listAll()).
        $moveName = $this->repository->findMachineMoveNamesByItem()[$payload['name']] ?? null;
        $payload['taught_move'] = $moveName !== null
            ? ['name' => $moveName, 'names' => $this->repository->findLocalizedNamesByTypeIndexedBySlug('move', ['es', 'en'])[$moveName] ?? []]
            : null;

        // effect_entries de `item` NUNCA trae español (mismo hueco real de PokeAPI ya
        // documentado para ability/move, ver .claude/memory/project_pokewebmax_progress.md
        // "paridad total") — fallback al "== Efecto ==" de WikiDex, mismo mecanismo ya
        // en marcha para habilidades/movimientos (WikidexEffectText, ver
        // app:wikidex:import-effects).
        $wikidexEffectText = $this->wikidexEffectTextRepository->findTextsByType('item')[$item->getResourceId()] ?? null;

        return [
            'item' => $payload,
            'wikidexEffectText' => $wikidexEffectText,
        ];
    }
}
