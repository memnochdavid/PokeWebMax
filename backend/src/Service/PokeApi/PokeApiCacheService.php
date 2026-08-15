<?php

namespace App\Service\PokeApi;

use App\Entity\PokeApiResourceCache;
use App\Repository\PokeApiResourceCacheRepository;
use Doctrine\ORM\EntityManagerInterface;

class PokeApiCacheService
{
    public function __construct(
        private readonly PokeApiClient $pokeApiClient,
        private readonly PokeApiResourceCacheRepository $repository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    /**
     * @throws ResourceNotFoundException
     * @throws \Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface
     */
    public function cache(string $resourceType, string $idOrName): PokeApiCacheResult
    {
        $existing = $this->repository->findByTypeAndIdOrName($resourceType, $idOrName);
        if ($existing !== null) {
            return new PokeApiCacheResult($existing, true);
        }

        $payload = $this->pokeApiClient->fetchResource($resourceType, $idOrName);

        $entity = new PokeApiResourceCache($resourceType, $payload['id']);
        $entity->setName($payload['name'] ?? $resourceType . '-' . $payload['id']);
        $entity->setPayload($payload);
        $entity->setFetchedAt(new \DateTimeImmutable());

        $this->em->persist($entity);
        $this->em->flush();

        return new PokeApiCacheResult($entity, false);
    }
}
