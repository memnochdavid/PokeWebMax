<?php

namespace App\Controller;

use App\Service\PokeApi\PokemonListService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

class PokemonListController extends AbstractController
{
    public function __construct(private readonly PokemonListService $listService)
    {
    }

    #[Route('/api/pokemon', name: 'api_pokemon_list', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        try {
            $items = $this->listService->listAll();
        } catch (TransportExceptionInterface) {
            return new JsonResponse(['error' => 'No se pudo contactar con PokeAPI.'], 502);
        }

        return new JsonResponse($items);
    }
}
