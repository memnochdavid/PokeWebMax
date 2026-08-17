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
 * `pokemon` — cierto para las ~1025 especies base.
 * `variants` (mega/gigamax/regional, con id y tipos propios) va también en cada fila
 * para que el frontend pueda mostrar la variante real en vez de la especie base
 * cuando el filtro de Mega/Gigamax/Regional está activo (ver
 * .claude/memory/project_pokewebmax_progress.md).
 */
class PokemonListService
{
    // Idiomas que ofrece el selector de idioma del frontend (LanguageContext.jsx) —
    // mantener sincronizado si se añade uno ahí.
    private const SUPPORTED_LANGUAGES = ['es', 'en'];

    public function __construct(
        private readonly PokeApiClient $pokeApiClient,
        private readonly PokeApiResourceCacheRepository $repository,
    ) {
    }

    /**
     * Nombre (en cada idioma soportado) y tipos de cada especie cacheada — para sitios
     * que necesitan esto sin cargar el Pokémon completo (lista de Pokémon, nombres +
     * colores de tipo de la cadena evolutiva en la ficha).
     *
     * @return array<int, array{names: array<string, string>, types: string[]}>
     */
    public function namesById(): array
    {
        $names = $this->repository->findSpeciesLocalizedNames(self::SUPPORTED_LANGUAGES);
        $typesById = $this->repository->findPokemonTypesById();

        $result = [];
        foreach ($names as $id => $localized) {
            $result[$id] = ['names' => $localized, 'types' => $typesById[$id] ?? []];
        }

        return $result;
    }

    /**
     * @return array<int, array{
     *     id: int, name: string, cached: bool, fetchedAt: ?string, types: string[],
     *     generation: ?int, legendary: bool, mythical: bool,
     *     hasMega: bool, hasGmax: bool, hasRegional: bool, evolutionStages: ?int,
     *     captureRate: ?int, weight: ?int, height: ?int, statsTotal: ?int,
     *     variants: array<int, array{id: int, name: string, kind: string, types: string[]}>,
     * }>
     */
    public function listAll(): array
    {
        $entries = $this->pokeApiClient->fetchResourceList('pokemon-species');
        $cachedFetchedAt = $this->repository->findFetchedAtByType('pokemon-species');
        $typesById = $this->repository->findPokemonTypesById();
        $speciesSummaries = $this->repository->findSpeciesSummaries();
        $chainDepths = $this->repository->findEvolutionChainDepths();
        $listMetrics = $this->repository->findPokemonListMetricsById();

        return array_map(
            function (array $entry) use ($cachedFetchedAt, $typesById, $speciesSummaries, $chainDepths, $listMetrics) {
                $fetchedAt = $cachedFetchedAt[$entry['id']] ?? null;
                $summary = $speciesSummaries[$entry['id']] ?? null;
                $evolutionChainId = $summary['evolutionChainId'] ?? null;
                $metrics = $listMetrics[$entry['id']] ?? null;
                $variants = array_map(
                    static fn (array $variant) => $variant + ['types' => $typesById[$variant['id']] ?? []],
                    $summary['variants'] ?? [],
                );

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
                    'captureRate' => $summary['captureRate'] ?? null,
                    'weight' => $metrics['weight'] ?? null,
                    'height' => $metrics['height'] ?? null,
                    'statsTotal' => $metrics['statsTotal'] ?? null,
                    'variants' => $variants,
                ];
            },
            $entries,
        );
    }
}
