<?php

namespace App\Controller;

use App\Service\PokeApi\ItemListService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class ItemNamesController extends AbstractController
{
    public function __construct(private readonly ItemListService $listService)
    {
    }

    #[Route('/api/items/names', name: 'api_item_names', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        return new JsonResponse($this->listService->namesById());
    }
}
