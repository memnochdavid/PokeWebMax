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
                $id = PokeApiUrl::idFromUrl($entry['url']);

                return [
                    'id' => $id,
                    'name' => $entry['name'] ?? $resourceType . '-' . $id,
                ];
            },
            $data['results'],
        );
    }

    /**
     * Cachea varios ids del mismo resourceType a la vez lanzando todas las peticiones
     * a PokeAPI en paralelo, en vez de una a una: `request()` con el HttpClient de
     * Symfony no bloquea hasta que se lee el cuerpo (`toArray()`), así que disparar
     * todas antes de leer ninguna las deja correr concurrentemente por debajo
     * (multiplexado por curl, ver `max_host_connections` en config/packages/
     * framework.yaml). Es lo que hace rápido el cacheo por lotes frente al cacheo
     * secuencial de uno en uno.
     *
     * @param int[] $ids
     * @return array<int, ?array> payload indexado por id; null si esa id dio 404
     */
    public function fetchManyResources(string $resourceType, array $ids): array
    {
        $responses = [];
        foreach ($ids as $id) {
            $responses[$id] = $this->httpClient->request('GET', self::BASE_URL . $resourceType . '/' . $id);
        }

        $results = [];
        foreach ($responses as $id => $response) {
            try {
                $results[$id] = $response->toArray();
            } catch (ClientExceptionInterface $e) {
                if ($e->getResponse()->getStatusCode() === 404) {
                    $results[$id] = null;
                    continue;
                }

                throw $e;
            }
        }

        return $results;
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
