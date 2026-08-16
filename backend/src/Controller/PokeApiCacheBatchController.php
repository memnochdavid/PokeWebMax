<?php

namespace App\Controller;

use App\Service\PokeApi\PokeApiCacheService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

class PokeApiCacheBatchController extends AbstractController
{
    // Límite defensivo por petición — el frontend manda lotes bastante más pequeños
    // (ver BATCH_SIZE en cachePokeApiResource.js), esto es solo para no aceptar un
    // array arbitrariamente grande.
    private const MAX_BATCH_SIZE = 100;

    public function __construct(private readonly PokeApiCacheService $cacheService)
    {
    }

    #[Route('/api/pokeapi/{resourceType}/cache-batch', name: 'api_pokeapi_cache_batch', methods: ['POST'])]
    public function __invoke(string $resourceType, Request $request): JsonResponse
    {
        $ids = json_decode($request->getContent(), true)['ids'] ?? null;

        if (!is_array($ids) || $ids === []) {
            return new JsonResponse(['error' => 'Se esperaba un array "ids" no vacío.'], 400);
        }

        if (count($ids) > self::MAX_BATCH_SIZE) {
            return new JsonResponse(['error' => 'Máximo ' . self::MAX_BATCH_SIZE . ' ids por lote.'], 400);
        }

        try {
            $result = $this->cacheService->cacheBatch($resourceType, $ids);
        } catch (TransportExceptionInterface) {
            return new JsonResponse(['error' => 'No se pudo contactar con PokeAPI.'], 502);
        }

        return new JsonResponse([
            'cached' => $result->cached,
            'alreadyCached' => $result->alreadyCached,
            'failed' => $result->failed,
        ]);
    }
}
