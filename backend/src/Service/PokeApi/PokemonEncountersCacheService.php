<?php

namespace App\Service\PokeApi;

use App\Entity\PokeApiResourceCache;
use App\Repository\PokeApiResourceCacheRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Contracts\Cache\CacheInterface;

/**
 * Cachea `pokemon/{id}/encounters` (encuentros salvajes por zona/versión) — separado de
 * PokeApiCacheService porque ese payload no trae `id`/`name` propios (es un sub-recurso
 * de `pokemon`, no un resourceType de PokeAPI con entidad propia), así que no puede
 * reusar su `cache()`/`cacheBatch()` tal cual. Alimenta el filtro "solo exclusivos de
 * este juego" del modo Juego de la lista (ver PokemonListService::computeListAll() y
 * .claude/memory/project_pokewebmax_progress.md) — se cachea el mismo `resourceType`
 * ('pokemon-encounters') en la misma tabla `pokeapi_resource_cache`, así que no hace
 * falta ninguna entidad/migración nueva.
 */
class PokemonEncountersCacheService
{
    public function __construct(
        private readonly PokeApiClient $pokeApiClient,
        private readonly PokeApiResourceCacheRepository $repository,
        private readonly EntityManagerInterface $em,
        private readonly CacheInterface $cache,
    ) {
    }

    /**
     * @param int[] $ids ids de Pokémon (no de un `pokemon-encounters` propio, que no
     *   existe como tal — la caché se guarda bajo el mismo id del Pokémon)
     */
    public function cacheBatch(array $ids): PokeApiCacheBatchResult
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        $existing = $this->repository->findExistingIds('pokemon-encounters', $ids);
        $toFetch = array_values(array_diff($ids, $existing));

        if ($toFetch === []) {
            return new PokeApiCacheBatchResult(0, count($existing), 0);
        }

        $names = $this->repository->findNamesByIds('pokemon', $toFetch);
        $payloads = $this->pokeApiClient->fetchManyPokemonEncounters($toFetch);

        $cached = 0;
        $failed = 0;
        foreach ($payloads as $id => $payload) {
            if ($payload === null) {
                $failed++;
                continue;
            }

            $entity = new PokeApiResourceCache('pokemon-encounters', $id);
            $entity->setName($names[$id] ?? ('pokemon-' . $id));
            $entity->setPayload($payload);
            $entity->setFetchedAt(new \DateTimeImmutable());
            $this->em->persist($entity);
            $cached++;
        }
        $this->em->flush();

        // A diferencia de PokeApiCacheService (cachear más pokemon/item/etc. no limpia
        // 'pokemon_list_all', se acepta el retraso del TTL de 300s porque el flujo
        // típico es "cachear en /cache, visitar la lista después"), el botón que
        // dispara este cacheo VIVE en la propia lista y se espera ver el resultado al
        // instante — así que se invalida ya mismo en vez de esperar al TTL.
        if ($cached > 0) {
            $this->cache->delete('pokemon_list_all');
        }

        return new PokeApiCacheBatchResult($cached, count($existing), $failed);
    }
}
