<?php

namespace App\Repository;

use App\Entity\PokeApiResourceCache;
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
}
