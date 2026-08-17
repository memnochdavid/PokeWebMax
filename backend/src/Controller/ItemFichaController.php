<?php

namespace App\Controller;

use App\Service\PokeApi\ItemFichaAssembler;
use App\Service\PokeApi\ItemNotCachedException;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class ItemFichaController extends AbstractController
{
    public function __construct(private readonly ItemFichaAssembler $assembler)
    {
    }

    #[Route('/api/items/{idOrName}/ficha', name: 'api_item_ficha', methods: ['GET'])]
    public function ficha(string $idOrName): JsonResponse
    {
        try {
            $ficha = $this->assembler->assemble($idOrName);
        } catch (ItemNotCachedException $e) {
            return new JsonResponse(['error' => $e->getMessage()], 404);
        }

        return new JsonResponse($ficha);
    }
}
