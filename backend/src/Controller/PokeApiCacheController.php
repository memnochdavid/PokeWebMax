<?php

namespace App\Controller;

use App\Service\PokeApi\PokeApiCacheService;
use App\Service\PokeApi\ResourceNotFoundException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

class PokeApiCacheController extends AbstractController
{
    public function __construct(private readonly PokeApiCacheService $cacheService)
    {
    }

    #[Route('/api/pokeapi/{resourceType}/cache/{idOrName}', name: 'api_pokeapi_cache', methods: ['POST'])]
    public function __invoke(string $resourceType, string $idOrName): JsonResponse
    {
        try {
            $result = $this->cacheService->cache($resourceType, $idOrName);
        } catch (ResourceNotFoundException $e) {
            return new JsonResponse(['error' => $e->getMessage()], 404);
        } catch (TransportExceptionInterface) {
            return new JsonResponse(['error' => 'No se pudo contactar con PokeAPI.'], 502);
        }

        $entity = $result->entity;

        return new JsonResponse([
            'resourceType' => $entity->getResourceType(),
            'id' => $entity->getResourceId(),
            'name' => $entity->getName(),
            'fetchedAt' => $entity->getFetchedAt()->format(DATE_ATOM),
            'alreadyCached' => $result->alreadyCached,
        ]);
    }
}
