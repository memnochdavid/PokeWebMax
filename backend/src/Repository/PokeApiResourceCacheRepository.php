<?php

namespace App\Repository;

use App\Entity\PokeApiResourceCache;
use App\Service\PokeApi\PokeApiUrl;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class PokeApiResourceCacheRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PokeApiResourceCache::class);
    }

    public function findByTypeAndIdOrName(string $resourceType, string $idOrName): ?PokeApiResourceCache
    {
        if (ctype_digit($idOrName)) {
            return $this->findOneBy(['resourceType' => $resourceType, 'resourceId' => (int) $idOrName]);
        }

        return $this->findOneBy(['resourceType' => $resourceType, 'name' => strtolower($idOrName)]);
    }

    /**
     * Versión ligera para listados: solo resourceId + fetchedAt, sin cargar el
     * `payload` completo — con recursos de miles de filas (item, move...) hidratar la
     * entidad entera agota la memoria de PHP para nada, ya que el listado solo necesita
     * saber qué está cacheado.
     *
     * @return array<int, \DateTimeImmutable> indexado por resourceId
     */
    public function findFetchedAtByType(string $resourceType): array
    {
        $rows = $this->createQueryBuilder('p')
            ->select('p.resourceId', 'p.fetchedAt')
            ->andWhere('p.resourceType = :type')
            ->setParameter('type', $resourceType)
            ->getQuery()
            ->getArrayResult();

        $result = [];
        foreach ($rows as $row) {
            $result[$row['resourceId']] = $row['fetchedAt'];
        }

        return $result;
    }

    /**
     * Solo para resourceType 'pokemon': extrae el array `types` de cada payload sin
     * hidratar el payload completo (~28KB por Pokémon). `JSON_EXTRACT` hace la
     * proyección en la propia consulta SQL, así que PHP solo decodifica el fragmento
     * `types` de cada fila, no el payload entero — mismo cuidado que
     * `findFetchedAtByType` con recursos grandes.
     *
     * @return array<int, string[]> nombres de tipo (ordenados por slot) indexados por resourceId
     */
    public function findPokemonTypesById(): array
    {
        $rows = $this->getEntityManager()->getConnection()->executeQuery(
            "SELECT resource_id, JSON_EXTRACT(payload, '$.types') AS types_json
             FROM pokeapi_resource_cache
             WHERE resource_type = 'pokemon'"
        )->fetchAllAssociative();

        $result = [];
        foreach ($rows as $row) {
            $types = json_decode((string) $row['types_json'], true) ?? [];
            usort($types, static fn (array $a, array $b) => $a['slot'] <=> $b['slot']);
            $result[(int) $row['resource_id']] = array_map(static fn (array $t) => $t['type']['name'], $types);
        }

        return $result;
    }

    /**
     * Nombre de cada especie en los idiomas soportados por el selector de idioma del
     * frontend (ver LanguageContext) — solo esos, no los ~9 que trae PokeAPI, para no
     * mandar de más. Usado donde se necesita el nombre localizado pero no el resto del
     * payload (lista de Pokémon, nombres de la cadena evolutiva en la ficha): esos
     * sitios no cargan la especie completa, así que no pueden leer `names` ellos
     * mismos como sí hace la propia ficha con su Pokémon actual.
     *
     * @param string[] $languages
     * @return array<int, array<string, string>> nombre por idioma, indexado por resourceId
     */
    public function findSpeciesLocalizedNames(array $languages): array
    {
        return $this->findLocalizedNamesByType('pokemon-species', $languages);
    }

    /**
     * Igual que findSpeciesLocalizedNames pero para cualquier resourceType con campo
     * `names` (ability, move...) — usado por el comando de importación de WikiDex para
     * cruzar por nombre 'es'/'es-419' (ver WikidexImportEffectsCommand).
     *
     * @param string[] $languages
     * @return array<int, array<string, string>> nombre por idioma, indexado por resourceId
     */
    public function findLocalizedNamesByType(string $resourceType, array $languages): array
    {
        $rows = $this->getEntityManager()->getConnection()->executeQuery(
            "SELECT resource_id, JSON_EXTRACT(payload, '$.names') AS names_json
             FROM pokeapi_resource_cache
             WHERE resource_type = :type",
            ['type' => $resourceType],
        )->fetchAllAssociative();

        $result = [];
        foreach ($rows as $row) {
            $names = json_decode((string) $row['names_json'], true) ?? [];
            $byLanguage = [];
            foreach ($names as $entry) {
                $lang = $entry['language']['name'] ?? null;
                if ($lang !== null && in_array($lang, $languages, true)) {
                    $byLanguage[$lang] = $entry['name'];
                }
            }
            $result[(int) $row['resource_id']] = $byLanguage;
        }

        return $result;
    }

    /**
     * Igual que findLocalizedNamesByType pero indexado por slug (columna `name`) en
     * vez de resourceId — para cuando quien llama ya tiene el slug a mano (ej. el
     * nombre del movimiento que enseña una MT/MO/DT, ver findMachineMoveNamesByItem)
     * y cruzar por id sería un paso de más.
     *
     * @param string[] $languages
     * @return array<string, array<string, string>> nombre por idioma, indexado por slug
     */
    public function findLocalizedNamesByTypeIndexedBySlug(string $resourceType, array $languages): array
    {
        $rows = $this->getEntityManager()->getConnection()->executeQuery(
            "SELECT name, JSON_EXTRACT(payload, '$.names') AS names_json
             FROM pokeapi_resource_cache
             WHERE resource_type = :type",
            ['type' => $resourceType],
        )->fetchAllAssociative();

        $result = [];
        foreach ($rows as $row) {
            $names = json_decode((string) $row['names_json'], true) ?? [];
            $byLanguage = [];
            foreach ($names as $entry) {
                $lang = $entry['language']['name'] ?? null;
                if ($lang !== null && in_array($lang, $languages, true)) {
                    $byLanguage[$lang] = $entry['name'];
                }
            }
            $result[$row['name']] = $byLanguage;
        }

        return $result;
    }

    /**
     * De una lista de ids candidatos, cuáles ya están cacheados para ese resourceType
     * — usado por el cacheo por lotes para no volver a pedirle a PokeAPI algo que ya
     * se tiene (defensivo: el frontend ya filtra por `cached` antes de mandar el
     * lote, pero esto lo hace correcto también si la lista que tenía el frontend
     * estaba desactualizada). Solo proyecta `resourceId`, sin tocar `payload`.
     *
     * @param int[] $ids
     * @return int[]
     */
    public function findExistingIds(string $resourceType, array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $rows = $this->createQueryBuilder('p')
            ->select('p.resourceId')
            ->andWhere('p.resourceType = :type')
            ->andWhere('p.resourceId IN (:ids)')
            ->setParameter('type', $resourceType)
            ->setParameter('ids', $ids)
            ->getQuery()
            ->getArrayResult();

        return array_map(static fn (array $row) => $row['resourceId'], $rows);
    }

    /**
     * Solo para resourceType 'pokemon-species': generación, legendario/singular y qué
     * formas especiales tiene (mega, gigamax, regional) — todo derivado por
     * JSON_EXTRACT del payload ya cacheado, sin llamar a PokeAPI ni hidratar la
     * entidad completa. Usado por el filtro de la vista de lista. `varieties` trae el
     * slug de cada forma (ej. "charizard-mega-x", "vulpix-alola"); se detecta por
     * substring del sufijo, no hay campo explícito en PokeAPI para esto.
     *
     * @return array<int, array{generation: ?int, legendary: bool, mythical: bool, hasMega: bool, hasGmax: bool, hasRegional: bool, evolutionChainId: ?int, captureRate: ?int, variants: array<int, array{id: int, name: string, kind: string}>}>
     */
    public function findSpeciesSummaries(): array
    {
        $rows = $this->getEntityManager()->getConnection()->executeQuery(
            "SELECT resource_id,
                    JSON_EXTRACT(payload, '$.generation.url') AS generation_url,
                    JSON_EXTRACT(payload, '$.is_legendary') AS is_legendary,
                    JSON_EXTRACT(payload, '$.is_mythical') AS is_mythical,
                    JSON_EXTRACT(payload, '$.varieties') AS varieties_json,
                    JSON_EXTRACT(payload, '$.evolution_chain.url') AS evolution_chain_url,
                    JSON_EXTRACT(payload, '$.capture_rate') AS capture_rate
             FROM pokeapi_resource_cache
             WHERE resource_type = 'pokemon-species'"
        )->fetchAllAssociative();

        $result = [];
        foreach ($rows as $row) {
            $generationUrl = json_decode((string) $row['generation_url']);
            $evolutionChainUrl = json_decode((string) $row['evolution_chain_url']);
            $varieties = json_decode((string) $row['varieties_json'], true) ?? [];
            $captureRate = json_decode((string) $row['capture_rate']);

            // Variedades especiales (mega/gigamax/regional) con su propio id de
            // `pokemon` — antes solo se guardaba un booleano "¿tiene mega?" y se
            // perdía CUÁL era; el filtro por Mega/Gigamax/Regional de la lista ahora
            // necesita mostrar la variedad real, no solo la especie base que la tiene
            // (ver .claude/memory/project_pokewebmax_progress.md).
            $variants = [];
            foreach ($varieties as $variety) {
                $varietyName = (string) ($variety['pokemon']['name'] ?? '');
                $kind = $this->classifyVariety($varietyName);
                $varietyUrl = (string) ($variety['pokemon']['url'] ?? '');
                if ($kind === null || $varietyUrl === '') {
                    continue;
                }
                $variants[] = [
                    'id' => PokeApiUrl::idFromUrl($varietyUrl),
                    'name' => $varietyName,
                    'kind' => $kind,
                ];
            }

            $result[(int) $row['resource_id']] = [
                'generation' => $generationUrl !== null ? PokeApiUrl::idFromUrl((string) $generationUrl) : null,
                'legendary' => $this->decodeJsonBool($row['is_legendary']),
                'mythical' => $this->decodeJsonBool($row['is_mythical']),
                'hasMega' => $this->anyVariantOfKind($variants, 'mega'),
                'hasGmax' => $this->anyVariantOfKind($variants, 'gmax'),
                'hasRegional' => $this->anyVariantOfKind($variants, 'regional'),
                'evolutionChainId' => $evolutionChainUrl !== null ? PokeApiUrl::idFromUrl((string) $evolutionChainUrl) : null,
                'captureRate' => $captureRate !== null ? (int) $captureRate : null,
                'variants' => $variants,
            ];
        }

        return $result;
    }

    private function classifyVariety(string $name): ?string
    {
        if (str_contains($name, '-mega')) {
            return 'mega';
        }
        if (str_contains($name, '-gmax')) {
            return 'gmax';
        }
        foreach (['-alola', '-galar', '-hisui', '-paldea'] as $suffix) {
            if (str_contains($name, $suffix)) {
                return 'regional';
            }
        }

        return null;
    }

    /**
     * @param array<int, array{kind: string}> $variants
     */
    private function anyVariantOfKind(array $variants, string $kind): bool
    {
        foreach ($variants as $variant) {
            if ($variant['kind'] === $kind) {
                return true;
            }
        }

        return false;
    }

    /**
     * Solo para resourceType 'pokemon': peso, altura y suma de stats base — métricas
     * de ordenación de la vista de lista (peso/altura/"total de stats"). Mismo criterio
     * que findPokemonTypesById: proyección por JSON_EXTRACT en la propia consulta para
     * no hidratar el payload completo de las ~1300 filas.
     *
     * @return array<int, array{weight: ?int, height: ?int, statsTotal: ?int}>
     */
    public function findPokemonListMetricsById(): array
    {
        $rows = $this->getEntityManager()->getConnection()->executeQuery(
            "SELECT resource_id,
                    JSON_EXTRACT(payload, '$.weight') AS weight,
                    JSON_EXTRACT(payload, '$.height') AS height,
                    JSON_EXTRACT(payload, '$.stats') AS stats_json
             FROM pokeapi_resource_cache
             WHERE resource_type = 'pokemon'"
        )->fetchAllAssociative();

        $result = [];
        foreach ($rows as $row) {
            $weight = json_decode((string) $row['weight']);
            $height = json_decode((string) $row['height']);
            $stats = json_decode((string) $row['stats_json'], true) ?? [];

            $result[(int) $row['resource_id']] = [
                'weight' => $weight !== null ? (int) $weight : null,
                'height' => $height !== null ? (int) $height : null,
                'statsTotal' => $stats !== [] ? array_sum(array_column($stats, 'base_stat')) : null,
            ];
        }

        return $result;
    }

    /**
     * Igual que findPokemonTypesById() + findPokemonListMetricsById() combinados en
     * UNA sola consulta — usado solo por PokemonListService::listAll(), que antes
     * llamaba a los dos por separado y por tanto leía el payload de las ~1350 filas de
     * `pokemon` (¬132KB de media cada una por la lista de movimientos completa) DOS
     * veces: JSON_EXTRACT no evita que el motor lea la columna `payload` entera de
     * cada fila para poder parsearla, aunque el resultado que viaje a PHP sea
     * pequeño. Medido: ~1,5s + ~2,8s por separado -> con esta única consulta ambos
     * costes se pagan una sola vez. Si algo nuevo necesita SOLO tipos o SOLO
     * peso/altura/stats, usar los métodos separados de arriba en vez de este.
     *
     * @return array<int, array{types: string[], weight: ?int, height: ?int, statsTotal: ?int}>
     */
    public function findPokemonTypesAndMetricsById(): array
    {
        $rows = $this->getEntityManager()->getConnection()->executeQuery(
            "SELECT resource_id,
                    JSON_EXTRACT(payload, '$.types') AS types_json,
                    JSON_EXTRACT(payload, '$.weight') AS weight,
                    JSON_EXTRACT(payload, '$.height') AS height,
                    JSON_EXTRACT(payload, '$.stats') AS stats_json
             FROM pokeapi_resource_cache
             WHERE resource_type = 'pokemon'"
        )->fetchAllAssociative();

        $result = [];
        foreach ($rows as $row) {
            $types = json_decode((string) $row['types_json'], true) ?? [];
            usort($types, static fn (array $a, array $b) => $a['slot'] <=> $b['slot']);
            $weight = json_decode((string) $row['weight']);
            $height = json_decode((string) $row['height']);
            $stats = json_decode((string) $row['stats_json'], true) ?? [];

            $result[(int) $row['resource_id']] = [
                'types' => array_map(static fn (array $t) => $t['type']['name'], $types),
                'weight' => $weight !== null ? (int) $weight : null,
                'height' => $height !== null ? (int) $height : null,
                'statsTotal' => $stats !== [] ? array_sum(array_column($stats, 'base_stat')) : null,
            ];
        }

        return $result;
    }

    /**
     * Solo para resourceType 'evolution-chain': profundidad de cada cadena (1, 2, 3...
     * etapas desde la base), calculada recorriendo `chain.evolves_to` en PHP. Los
     * payloads de este recurso son pequeños (a diferencia de pokemon-species), así que
     * aquí sí se decodifica el payload completo — solo ~540 filas en total.
     *
     * @return array<int, int> profundidad indexada por resourceId (id de la cadena)
     */
    public function findEvolutionChainDepths(): array
    {
        $rows = $this->getEntityManager()->getConnection()->executeQuery(
            "SELECT resource_id, payload FROM pokeapi_resource_cache WHERE resource_type = 'evolution-chain'"
        )->fetchAllAssociative();

        $result = [];
        foreach ($rows as $row) {
            $payload = json_decode((string) $row['payload'], true);
            $chain = $payload['chain'] ?? null;
            $result[(int) $row['resource_id']] = $chain !== null ? $this->chainDepth($chain) : 1;
        }

        return $result;
    }

    private function chainDepth(array $chainNode): int
    {
        $childDepths = array_map(
            fn (array $child) => $this->chainDepth($child),
            $chainNode['evolves_to'] ?? [],
        );

        return 1 + (count($childDepths) > 0 ? max($childDepths) : 0);
    }

    private function decodeJsonBool(mixed $raw): bool
    {
        $decoded = json_decode((string) $raw);

        return $decoded === true || $decoded === 1;
    }

    /**
     * Solo para resourceType 'item': categoría y coste de cada objeto cacheado —
     * proyección ligera para el listado/filtro, sin hidratar el payload completo
     * (efectos/descripciones/game_indices no hacen falta ahí). El "pocket" (bolsillo,
     * agrupación más amplia que categoría) no vive en `item`, hay que cruzarlo con
     * `item-category` — ver findItemCategoryPockets().
     *
     * @return array<string, array{category: string, cost: ?int}> indexado por nombre (slug) del item
     */
    public function findItemSummaries(): array
    {
        $rows = $this->getEntityManager()->getConnection()->executeQuery(
            "SELECT name,
                    JSON_EXTRACT(payload, '$.category.name') AS category_name,
                    JSON_EXTRACT(payload, '$.cost') AS cost
             FROM pokeapi_resource_cache
             WHERE resource_type = 'item'"
        )->fetchAllAssociative();

        $result = [];
        foreach ($rows as $row) {
            $cost = json_decode((string) $row['cost']);
            $result[$row['name']] = [
                'category' => (string) json_decode((string) $row['category_name']),
                'cost' => $cost !== null ? (int) $cost : null,
            ];
        }

        return $result;
    }

    /**
     * Solo para resourceType 'item-category': el "pocket" (bolsillo de la mochila) de
     * cada categoría de objeto — son solo 54 filas, se decodifica el payload entero.
     *
     * @return array<string, string> nombre de pocket indexado por nombre de categoría
     */
    public function findItemCategoryPockets(): array
    {
        $rows = $this->getEntityManager()->getConnection()->executeQuery(
            "SELECT name, JSON_EXTRACT(payload, '$.pocket.name') AS pocket_name
             FROM pokeapi_resource_cache
             WHERE resource_type = 'item-category'"
        )->fetchAllAssociative();

        $result = [];
        foreach ($rows as $row) {
            $result[$row['name']] = (string) json_decode((string) $row['pocket_name']);
        }

        return $result;
    }

    /**
     * Orden de preferencia de version_group para decidir qué movimiento representa
     * cada MT/MO/DT — el mismo número de máquina enseña movimientos distintos según
     * el juego (ver `machine`: item+move+version_group). Mismo criterio y mismas
     * listas que scripts/build_item_icon_map.py (el icono por tipo de esas máquinas
     * usa esta misma resolución) — si se toca una, hay que tocar la otra.
     */
    private const MACHINE_VERSION_GROUP_PRIORITY = [
        'tm' => ['scarlet-violet', 'the-teal-mask', 'the-indigo-disk', 'legends-za'],
        'hm' => [
            'brilliant-diamond-shining-pearl', 'omega-ruby-alpha-sapphire', 'x-y',
            'black-2-white-2', 'black-white', 'heartgold-soulsilver', 'platinum',
            'diamond-pearl', 'firered-leafgreen', 'emerald', 'ruby-sapphire',
            'crystal', 'gold-silver', 'yellow', 'red-blue',
        ],
        'tr' => ['sword-shield'],
    ];

    /**
     * Solo para resourceType 'machine': qué movimiento enseña cada MT/MO/DT ("tmNN",
     * "hmNN", "trNN") — usado para mostrarlo en la card/ficha del objeto, no solo para
     * elegir icono (ver MACHINE_VERSION_GROUP_PRIORITY arriba).
     *
     * @return array<string, string> slug de movimiento indexado por slug de item
     */
    public function findMachineMoveNamesByItem(): array
    {
        $rows = $this->getEntityManager()->getConnection()->executeQuery(
            "SELECT JSON_UNQUOTE(JSON_EXTRACT(payload, '$.item.name')) AS item_name,
                    JSON_UNQUOTE(JSON_EXTRACT(payload, '$.move.name')) AS move_name,
                    JSON_UNQUOTE(JSON_EXTRACT(payload, '$.version_group.name')) AS version_group
             FROM pokeapi_resource_cache
             WHERE resource_type = 'machine'
               AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.item.name')) REGEXP '^(tm|hm|tr)[0-9]+$'"
        )->fetchAllAssociative();

        $moveByItemAndGroup = [];
        foreach ($rows as $row) {
            $moveByItemAndGroup[$row['item_name']][$row['version_group']] = $row['move_name'];
        }

        $result = [];
        foreach ($moveByItemAndGroup as $itemName => $movesByGroup) {
            $prefix = substr($itemName, 0, 2);
            $priority = self::MACHINE_VERSION_GROUP_PRIORITY[$prefix] ?? [];
            foreach ($priority as $versionGroup) {
                if (isset($movesByGroup[$versionGroup])) {
                    $result[$itemName] = $movesByGroup[$versionGroup];
                    continue 2;
                }
            }
        }

        return $result;
    }
}
