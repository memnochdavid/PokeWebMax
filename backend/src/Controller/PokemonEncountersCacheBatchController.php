<?php

namespace App\Controller;

use App\Service\PokeApi\PokemonEncountersCacheService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

class PokemonEncountersCacheBatchController extends AbstractController
{
    // Mismo límite defensivo que PokeApiCacheBatchController — el frontend manda lotes
    // más pequeños (ver BATCH_SIZE en cachePokeApiResource.js).
    private const MAX_BATCH_SIZE = 100;

    public function __construct(private readonly PokemonEncountersCacheService $cacheService)
    {
    }

    #[Route('/api/pokemon/encounters/cache-batch', name: 'api_pokemon_encounters_cache_batch', methods: ['POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        $ids = json_decode($request->getContent(), true)['ids'] ?? null;

        if (!is_array($ids) || $ids === []) {
            return new JsonResponse(['error' => 'Se esperaba un array "ids" no vacío.'], 400);
        }

        if (count($ids) > self::MAX_BATCH_SIZE) {
            return new JsonResponse(['error' => 'Máximo ' . self::MAX_BATCH_SIZE . ' ids por lote.'], 400);
        }

        try {
            $result = $this->cacheService->cacheBatch($ids);
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
