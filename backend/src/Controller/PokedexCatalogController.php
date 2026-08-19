<?php

namespace App\Controller;

use App\Service\PokeApi\PokemonListService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class PokedexCatalogController extends AbstractController
{
    public function __construct(private readonly PokemonListService $listService)
    {
    }

    #[Route('/api/pokedex-catalog', name: 'api_pokedex_catalog', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        return new JsonResponse($this->listService->pokedexCatalog());
    }
}
