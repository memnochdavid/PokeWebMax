<?php

namespace App\Service\PokeApi;

use App\Repository\PokeApiResourceCacheRepository;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

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

    // listAll() recorre el payload completo de las ~1350 filas de `pokemon` (¬132KB de
    // media cada una, hasta 700KB en casos como Mew) para sacar tipos/peso/altura/
    // stats — leer y parsear esa cantidad de JSON en el motor de la BD cuesta ~3,5s
    // media independientemente de cuántos campos se pidan a la vez (medido: ver
    // .claude/memory/project_pokewebmax_progress.md). No hay forma barata de evitar esa
    // lectura en cada llamada sin columnas generadas + índice (cambio de esquema más
    // grande), así que se cachea el resultado YA COMPUTADO en vez de la query. TTL
    // corto a propósito: esta vista es la única forma de ver qué hay cacheado, así que
    // una desactualización larga tras pulsar "cachear" en /cache se notaría.
    private const LIST_CACHE_TTL_SECONDS = 300;

    public function __construct(
        private readonly PokeApiClient $pokeApiClient,
        private readonly PokeApiResourceCacheRepository $repository,
        private readonly CacheInterface $cache,
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
        return $this->cache->get(
            'pokemon_names_by_id',
            function (ItemInterface $item) {
                $item->expiresAfter(self::LIST_CACHE_TTL_SECONDS);

                $names = $this->repository->findSpeciesLocalizedNames(self::SUPPORTED_LANGUAGES);
                $typesById = $this->repository->findPokemonTypesById();

                $result = [];
                foreach ($names as $id => $localized) {
                    $result[$id] = ['names' => $localized, 'types' => $typesById[$id] ?? []];
                }

                return $result;
            },
        );
    }

    /**
     * @return array<int, array{
     *     id: int, name: string, cached: bool, fetchedAt: ?string, types: string[],
     *     generation: ?int, legendary: bool, mythical: bool,
     *     hasMega: bool, hasGmax: bool, hasRegional: bool, evolutionStages: ?int,
     *     captureRate: ?int, weight: ?int, height: ?int, statsTotal: ?int,
     *     variants: array<int, array{id: int, name: string, kind: string, types: string[]}>,
     *     pokedexNumbers: array<string, int>,
     *     encounterVersions: string[], encountersCached: bool,
     * }>
     */
    public function listAll(): array
    {
        return $this->cache->get(
            'pokemon_list_all',
            function (ItemInterface $item) {
                $item->expiresAfter(self::LIST_CACHE_TTL_SECONDS);

                return $this->computeListAll();
            },
        );
    }

    /**
     * @return array<int, array{
     *     id: int, name: string, cached: bool, fetchedAt: ?string, types: string[],
     *     generation: ?int, legendary: bool, mythical: bool,
     *     hasMega: bool, hasGmax: bool, hasRegional: bool, evolutionStages: ?int,
     *     captureRate: ?int, weight: ?int, height: ?int, statsTotal: ?int,
     *     variants: array<int, array{id: int, name: string, kind: string, types: string[]}>,
     *     pokedexNumbers: array<string, int>,
     *     encounterVersions: string[], encountersCached: bool,
     * }>
     */
    private function computeListAll(): array
    {
        $entries = $this->pokeApiClient->fetchResourceList('pokemon-species');
        $cachedFetchedAt = $this->repository->findFetchedAtByType('pokemon-species');
        // Tipos + peso/altura/stats en una sola pasada por `pokemon` (~1350 filas,
        // ¬132KB de media cada una) en vez de dos por separado — ver el porqué en el
        // docblock de findPokemonTypesAndMetricsById().
        $typesAndMetricsById = $this->repository->findPokemonTypesAndMetricsById();
        $speciesSummaries = $this->repository->findSpeciesSummaries();
        $chainDepths = $this->repository->findEvolutionChainDepths();
        // Solo para el filtro "solo exclusivos de este juego" — vacío para la inmensa
        // mayoría de especies hasta que David cachee encuentros desde el botón
        // contextual de la lista (ver PokemonEncountersCacheService), nunca desde aquí.
        $encounterVersionsById = $this->repository->findEncounterVersionsBySpecies();

        return array_map(
            function (array $entry) use ($cachedFetchedAt, $typesAndMetricsById, $speciesSummaries, $chainDepths, $encounterVersionsById) {
                $fetchedAt = $cachedFetchedAt[$entry['id']] ?? null;
                $summary = $speciesSummaries[$entry['id']] ?? null;
                $evolutionChainId = $summary['evolutionChainId'] ?? null;
                $metrics = $typesAndMetricsById[$entry['id']] ?? null;
                $variants = array_map(
                    static fn (array $variant) => $variant + ['types' => $typesAndMetricsById[$variant['id']]['types'] ?? []],
                    $summary['variants'] ?? [],
                );

                return [
                    'id' => $entry['id'],
                    'name' => $entry['name'],
                    'cached' => $fetchedAt !== null,
                    'fetchedAt' => $fetchedAt?->format(DATE_ATOM),
                    'types' => $metrics['types'] ?? [],
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
                    'pokedexNumbers' => $summary['pokedexNumbers'] ?? [],
                    'encounterVersions' => $encounterVersionsById[$entry['id']] ?? [],
                    'encountersCached' => isset($encounterVersionsById[$entry['id']]),
                ];
            },
            $entries,
        );
    }

    /**
     * Catálogo de Pokédex regionales + juegos para el selector Nacional/Regional de la
     * vista de lista (ver PokeApiResourceCacheRepository::findPokedexBrowserCatalog()).
     * Mismo criterio de caché que listAll()/namesById(): resultado ya computado, TTL
     * corto porque depende de qué haya cacheado localmente el propio David.
     *
     * @return array{
     *     pokedexes: array<int, array{id:int, name:string, region:string, label:array<string,string>}>,
     *     versions: array<int, array{id:int, name:string, label:array<string,string>, pokedexNames:string[], groupVersions:string[]}>,
     * }
     */
    public function pokedexCatalog(): array
    {
        return $this->cache->get(
            'pokedex_catalog',
            function (ItemInterface $item) {
                $item->expiresAfter(self::LIST_CACHE_TTL_SECONDS);

                return $this->repository->findPokedexBrowserCatalog(self::SUPPORTED_LANGUAGES);
            },
        );
    }
}
