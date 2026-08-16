<?php

namespace App\Repository;

use App\Entity\WikidexFlavorText;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class WikidexFlavorTextRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, WikidexFlavorText::class);
    }

    public function findOneBySpeciesAndVersion(int $pokemonSpeciesId, string $versionSlug): ?WikidexFlavorText
    {
        return $this->findOneBy(['pokemonSpeciesId' => $pokemonSpeciesId, 'versionSlug' => $versionSlug]);
    }

    /**
     * Todo el fallback de WikiDex disponible para una especie, listo para que el
     * frontend lo use como tercer nivel de flavorTextsByVersion() (PokeAPI-ES ->
     * WikiDex-ES -> PokeAPI-EN, ver utils/pokemonFicha.js).
     *
     * @return array<string, string> texto indexado por version slug de PokeAPI
     */
    public function findTextsBySpeciesId(int $pokemonSpeciesId): array
    {
        $rows = $this->createQueryBuilder('w')
            ->select('w.versionSlug', 'w.text')
            ->andWhere('w.pokemonSpeciesId = :speciesId')
            ->setParameter('speciesId', $pokemonSpeciesId)
            ->getQuery()
            ->getArrayResult();

        $result = [];
        foreach ($rows as $row) {
            $result[$row['versionSlug']] = $row['text'];
        }

        return $result;
    }
}
