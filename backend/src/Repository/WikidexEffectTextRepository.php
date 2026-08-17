<?php

namespace App\Repository;

use App\Entity\WikidexEffectText;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class WikidexEffectTextRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, WikidexEffectText::class);
    }

    public function findOneByTypeAndId(string $resourceType, int $resourceId): ?WikidexEffectText
    {
        return $this->findOneBy(['resourceType' => $resourceType, 'resourceId' => $resourceId]);
    }

    /**
     * Todo el fallback de WikiDex disponible para un tipo de recurso ('ability' o
     * 'move'), listo para que el ensamblador de ficha lo use sin una consulta por
     * habilidad/movimiento.
     *
     * @return array<int, string> texto indexado por resourceId
     */
    public function findTextsByType(string $resourceType): array
    {
        $rows = $this->createQueryBuilder('w')
            ->select('w.resourceId', 'w.text')
            ->andWhere('w.resourceType = :type')
            ->setParameter('type', $resourceType)
            ->getQuery()
            ->getArrayResult();

        $result = [];
        foreach ($rows as $row) {
            $result[$row['resourceId']] = $row['text'];
        }

        return $result;
    }
}
