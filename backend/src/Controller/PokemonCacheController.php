<?php

namespace App\Controller;

use App\Service\PokeApi\PokemonCacheService;
use App\Service\PokeApi\PokemonNotFoundException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

class PokemonCacheController extends AbstractController
{
    public function __construct(private readonly PokemonCacheService $cacheService)
    {
    }

    #[Route('/api/pokemon/cache/{idOrName}', name: 'api_pokemon_cache', methods: ['POST'])]
    public function __invoke(string $idOrName): JsonResponse
    {
        try {
            $result = $this->cacheService->cache($idOrName);
        } catch (PokemonNotFoundException $e) {
            return new JsonResponse(['error' => $e->getMessage()], 404);
        } catch (TransportExceptionInterface) {
            return new JsonResponse(['error' => 'No se pudo contactar con PokeAPI.'], 502);
        }

        $entity = $result->entity;

        return new JsonResponse([
            'id' => $entity->getId(),
            'name' => $entity->getName(),
            'spriteUrl' => $entity->getSpriteUrl(),
            'types' => $entity->getTypes(),
            'colorName' => $entity->getColorName(),
            'generationId' => $entity->getGenerationId(),
            'fetchedAt' => $entity->getFetchedAt()->format(DATE_ATOM),
            'wasCached' => $result->wasCached,
        ]);
    }
}
