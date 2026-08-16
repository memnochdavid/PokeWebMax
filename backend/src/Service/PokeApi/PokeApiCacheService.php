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

    /**
     * Cachea un lote de ids del mismo resourceType de un tirón — a diferencia de
     * cache() (un id, una llamada a PokeAPI, un flush), esto pide todos los payloads
     * en paralelo (ver PokeApiClient::fetchManyResources) y hace un único flush al
     * final. Es lo que usa el botón "Cachear todo" en vez de repetir cache() por
     * cada id; sigue siendo una acción manual (el frontend decide cuándo llamar a
     * esto y con qué ids), no cacheo automático.
     *
     * @param int[] $ids
     * @throws \Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface
     */
    public function cacheBatch(string $resourceType, array $ids): PokeApiCacheBatchResult
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        $existing = $this->repository->findExistingIds($resourceType, $ids);
        $toFetch = array_values(array_diff($ids, $existing));

        if ($toFetch === []) {
            return new PokeApiCacheBatchResult(0, count($existing), 0);
        }

        $payloads = $this->pokeApiClient->fetchManyResources($resourceType, $toFetch);

        $cached = 0;
        $failed = 0;
        foreach ($payloads as $payload) {
            if ($payload === null) {
                $failed++;
                continue;
            }

            $entity = new PokeApiResourceCache($resourceType, $payload['id']);
            $entity->setName($payload['name'] ?? $resourceType . '-' . $payload['id']);
            $entity->setPayload($payload);
            $entity->setFetchedAt(new \DateTimeImmutable());
            $this->em->persist($entity);
            $cached++;
        }
        $this->em->flush();

        return new PokeApiCacheBatchResult($cached, count($existing), $failed);
    }
}
