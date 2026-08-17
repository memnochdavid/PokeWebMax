<?php

namespace App\Controller;

use App\Service\PokeApi\ItemListService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

class ItemListController extends AbstractController
{
    public function __construct(private readonly ItemListService $listService)
    {
    }

    #[Route('/api/items', name: 'api_item_list', methods: ['GET'])]
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
