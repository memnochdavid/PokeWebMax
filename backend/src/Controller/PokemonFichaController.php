<?php

namespace App\Controller;

use App\Service\PokeApi\PokemonFichaAssembler;
use App\Service\PokeApi\PokemonFichaCacheService;
use App\Service\PokeApi\PokemonNotCachedException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

class PokemonFichaController extends AbstractController
{
    public function __construct(
        private readonly PokemonFichaAssembler $assembler,
        private readonly PokemonFichaCacheService $fichaCacheService,
    ) {
    }

    #[Route('/api/pokemon/{idOrName}/ficha', name: 'api_pokemon_ficha', methods: ['GET'])]
    public function ficha(string $idOrName): JsonResponse
    {
        try {
            $ficha = $this->assembler->assemble($idOrName);
        } catch (PokemonNotCachedException $e) {
            return new JsonResponse(['error' => $e->getMessage()], 404);
        }

        return new JsonResponse($ficha);
    }

    #[Route('/api/pokemon/{idOrName}/ficha/cache-missing', name: 'api_pokemon_ficha_cache_missing', methods: ['POST'])]
    public function cacheMissing(string $idOrName): JsonResponse
    {
        try {
            $this->fichaCacheService->cacheMissing($idOrName);
            $ficha = $this->assembler->assemble($idOrName);
        } catch (PokemonNotCachedException $e) {
            return new JsonResponse(['error' => $e->getMessage()], 404);
        } catch (TransportExceptionInterface) {
            return new JsonResponse(['error' => 'No se pudo contactar con PokeAPI.'], 502);
        }

        return new JsonResponse($ficha);
    }
}
