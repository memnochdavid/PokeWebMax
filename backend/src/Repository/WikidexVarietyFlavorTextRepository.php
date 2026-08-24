<?php

namespace App\Repository;

use App\Entity\WikidexVarietyFlavorText;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class WikidexVarietyFlavorTextRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, WikidexVarietyFlavorText::class);
    }

    /** Descripción propia de esta variante (mega/gmax) si WikiDex la cubre, o null. */
    public function findTextByPokemonName(string $pokemonName): ?string
    {
        return $this->findOneBy(['pokemonName' => $pokemonName])?->getText();
    }
}
