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
                ];
            },
            $entries,
        );
    }
}
