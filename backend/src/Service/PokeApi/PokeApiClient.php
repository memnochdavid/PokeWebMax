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

    public function fetchPokemon(string $idOrName): array
    {
        return $this->get('pokemon/' . strtolower($idOrName), $idOrName);
    }

    public function fetchSpecies(string $idOrName): array
    {
        return $this->get('pokemon-species/' . strtolower($idOrName), $idOrName);
    }

    private function get(string $path, string $idOrName): array
    {
        try {
            return $this->httpClient->request('GET', self::BASE_URL . $path)->toArray();
        } catch (ClientExceptionInterface $e) {
            if ($e->getResponse()->getStatusCode() === 404) {
                throw new PokemonNotFoundException($idOrName);
            }

            throw $e;
        }
    }
}
