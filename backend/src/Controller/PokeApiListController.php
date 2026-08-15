<?php

namespace App\Controller;

use App\Service\PokeApi\PokeApiListService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

class PokeApiListController extends AbstractController
{
    public function __construct(private readonly PokeApiListService $listService)
    {
    }

    #[Route('/api/pokeapi/{resourceType}', name: 'api_pokeapi_list', methods: ['GET'])]
    public function __invoke(string $resourceType): JsonResponse
    {
        try {
            $items = $this->listService->listAll($resourceType);
        } catch (TransportExceptionInterface) {
            return new JsonResponse(['error' => 'No se pudo contactar con PokeAPI.'], 502);
        }

        return new JsonResponse($items);
    }
}
