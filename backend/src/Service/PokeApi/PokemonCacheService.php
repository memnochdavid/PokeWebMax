<?php

namespace App\Service\PokeApi;

use App\Repository\PokemonCacheRepository;
use Doctrine\ORM\EntityManagerInterface;

class PokemonCacheService
{
    public function __construct(
        private readonly PokeApiClient $pokeApiClient,
        private readonly PokemonCacheMapper $mapper,
        private readonly PokemonCacheRepository $repository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @throws PokemonNotFoundException
     * @throws \Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface
     */
    public function cache(string $idOrName): PokemonCacheResult
    {
        $pokemon = $this->pokeApiClient->fetchPokemon($idOrName);
        $species = $this->pokeApiClient->fetchSpecies($idOrName);

        $existing = $this->repository->find($pokemon['id']);
        $wasCached = $existing !== null;

        $entity = $this->mapper->map($pokemon, $species, $existing);

        if (!$wasCached) {
            $this->em->persist($entity);
        }
        $this->em->flush();

        return new PokemonCacheResult($entity, $wasCached);
    }
}
