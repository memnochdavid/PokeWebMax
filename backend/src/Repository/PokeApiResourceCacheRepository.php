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
     * @return array<int, array{generation: ?int, legendary: bool, mythical: bool, hasMega: bool, hasGmax: bool, hasRegional: bool, evolutionChainId: ?int}>
     */
    public function findSpeciesSummaries(): array
    {
        $rows = $this->getEntityManager()->getConnection()->executeQuery(
            "SELECT resource_id,
                    JSON_EXTRACT(payload, '$.generation.url') AS generation_url,
                    JSON_EXTRACT(payload, '$.is_legendary') AS is_legendary,
                    JSON_EXTRACT(payload, '$.is_mythical') AS is_mythical,
                    JSON_EXTRACT(payload, '$.varieties') AS varieties_json,
                    JSON_EXTRACT(payload, '$.evolution_chain.url') AS evolution_chain_url
             FROM pokeapi_resource_cache
             WHERE resource_type = 'pokemon-species'"
        )->fetchAllAssociative();

        $result = [];
        foreach ($rows as $row) {
            $generationUrl = json_decode((string) $row['generation_url']);
            $evolutionChainUrl = json_decode((string) $row['evolution_chain_url']);
            $varieties = json_decode((string) $row['varieties_json'], true) ?? [];
            $varietyNames = array_map(static fn (array $v) => (string) ($v['pokemon']['name'] ?? ''), $varieties);

            $result[(int) $row['resource_id']] = [
                'generation' => $generationUrl !== null ? PokeApiUrl::idFromUrl((string) $generationUrl) : null,
                'legendary' => $this->decodeJsonBool($row['is_legendary']),
                'mythical' => $this->decodeJsonBool($row['is_mythical']),
                'hasMega' => $this->anyVarietyContains($varietyNames, '-mega'),
                'hasGmax' => $this->anyVarietyContains($varietyNames, '-gmax'),
                'hasRegional' => $this->anyVarietyContains($varietyNames, ['-alola', '-galar', '-hisui', '-paldea']),
                'evolutionChainId' => $evolutionChainUrl !== null ? PokeApiUrl::idFromUrl((string) $evolutionChainUrl) : null,
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
     * @param string[] $varietyNames
     * @param string|string[] $needle
     */
    private function anyVarietyContains(array $varietyNames, string|array $needle): bool
    {
        $needles = is_array($needle) ? $needle : [$needle];
        foreach ($varietyNames as $name) {
            foreach ($needles as $n) {
                if (str_contains($name, $n)) {
                    return true;
                }
            }
        }

        return false;
    }
}
