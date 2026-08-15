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
}
