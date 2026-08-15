<?php

namespace App\Service\PokeApi;

use Symfony\Contracts\HttpClient\Exception\ClientExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class PokeApiClient
{
    private const BASE_URL = 'https://pokeapi.co/api/v2/';

    public function __construct(private readonly HttpClientInterface $httpClient)
    {
    }

    public function fetchResource(string $resourceType, string $idOrName): array
    {
        return $this->get($resourceType, $idOrName);
    }

    /**
     * Lista completa de un recurso (id + nombre) tal como lo conoce PokeAPI. Un único
     * GET, sin ficha — para eso hace falta cachear cada uno explícitamente.
     *
     * Algunos recursos (contest-effect, super-contest-effect, evolution-chain, machine,
     * characteristic) no tienen `name` ni en el listado ni en la ficha — solo `id`. Se
     * usa un nombre sintético `{resourceType}-{id}` para esos casos.
     *
     * @return array<int, array{id: int, name: string}>
     */
    public function fetchResourceList(string $resourceType): array
    {
        $data = $this->httpClient
            ->request('GET', self::BASE_URL . $resourceType . '?limit=100000')
            ->toArray();

        return array_map(
            function (array $entry) use ($resourceType) {
                $id = $this->extractIdFromUrl($entry['url']);

                return [
                    'id' => $id,
                    'name' => $entry['name'] ?? $resourceType . '-' . $id,
                ];
            },
            $data['results'],
        );
    }

    private function extractIdFromUrl(string $url): int
    {
        $segments = array_values(array_filter(explode('/', rtrim($url, '/'))));

        return (int) end($segments);
    }

    private function get(string $resourceType, string $idOrName): array
    {
        try {
            return $this->httpClient
                ->request('GET', self::BASE_URL . $resourceType . '/' . strtolower($idOrName))
                ->toArray();
        } catch (ClientExceptionInterface $e) {
            if ($e->getResponse()->getStatusCode() === 404) {
                throw new ResourceNotFoundException($resourceType, $idOrName);
            }

            throw $e;
        }
    }
}
