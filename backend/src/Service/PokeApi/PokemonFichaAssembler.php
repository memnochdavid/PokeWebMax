<?php

namespace App\Service\PokeApi;

use App\Entity\PokeApiResourceCache;
use App\Repository\PokeApiResourceCacheRepository;
use App\Repository\WikidexEffectTextRepository;
use App\Repository\WikidexFlavorTextRepository;
use App\Repository\WikidexVarietyFlavorTextRepository;

class PokemonFichaAssembler
{
    public function __construct(
        private readonly PokeApiResourceCacheRepository $repository,
        private readonly WikidexFlavorTextRepository $wikidexFlavorTextRepository,
        private readonly WikidexEffectTextRepository $wikidexEffectTextRepository,
        private readonly WikidexVarietyFlavorTextRepository $wikidexVarietyFlavorTextRepository,
    ) {
    }

    /**
     * Compone la ficha completa de un Pokémon a partir de lo que ya está cacheado
     * localmente (pokemon, pokemon-species, evolution-chain, moves, abilities, forms).
     * No dispara ningún fetch a PokeAPI ni cachea nada nuevo — el cacheo es siempre una
     * acción explícita del usuario (ver PokemonFichaCacheService). Cada pieza no
     * cacheada se devuelve como `null`/`cached: false` y se resume en `missing` para
     * que el frontend marque qué sección tiene datos pendientes de cachear.
     *
     * @throws PokemonNotCachedException si el propio Pokémon no está cacheado
     */
    public function assemble(string $idOrName): array
    {
        $pokemon = $this->repository->findByTypeAndIdOrName('pokemon', $idOrName);
        if ($pokemon === null) {
            throw new PokemonNotCachedException($idOrName);
        }

        $payload = $pokemon->getPayload();

        $species = $this->resolveOne('pokemon-species', $payload['species']['url'] ?? null);
        $evolutionChain = $species !== null
            ? $this->resolveOne('evolution-chain', $species->getPayload()['evolution_chain']['url'] ?? null)
            : null;
        $moves = $this->resolveMany('move', array_column($payload['moves'] ?? [], 'move'));
        $abilities = $this->resolveMany('ability', array_column($payload['abilities'] ?? [], 'ability'));
        // `pokemon.forms` (lo que se usaba antes) solo trae la forma por defecto de
        // ESTE pokemon en concreto — para ver regionales/mega/gigamax hay que ir a
        // `species.varieties`, que si lista todas las variantes reales (cada una con
        // su propio `pokemon`, no `pokemon-form`: así se resuelven también sprites y
        // tipos propios, ver .claude/memory/project_pokewebmax_progress.md).
        $varieties = $species?->getPayload()['varieties'] ?? [];
        $forms = $this->resolveMany('pokemon', array_column($varieties, 'pokemon'));

        return [
            'pokemon' => $payload,
            'species' => $species?->getPayload(),
            'evolutionChain' => $evolutionChain?->getPayload(),
            'moves' => $moves,
            'abilities' => $abilities,
            'forms' => $forms,
            'versionMeta' => $this->resolveVersionMeta($species?->getPayload() ?? [], $payload),
            // Fallback de descripción en español (ver flavorTextsByVersion() en
            // frontend/src/utils/pokemonFicha.js) para versiones donde PokeAPI no
            // tiene flavor_text_entries en 'es' — importado offline del dump de
            // WikiDex, ver .claude/memory/project_pokewebmax_wikidex_dump_analysis.md.
            'wikidexFlavorText' => $species !== null
                ? $this->wikidexFlavorTextRepository->findTextsBySpeciesId($species->getResourceId())
                : [],
            // Descripción propia de Megaevolución/Gigamax (WikidexVarietyFlavorText,
            // ver esa entidad para el porqué) — null para formas base y para
            // variantes sin esa página parseada todavía. Pedido por David 2026-08-24:
            // el frontend la prioriza sobre la ficha de PokeAPI/WikiDex por versión
            // para estas formas, ya que PokeAPI no distingue variante en absoluto
            // para este campo (comparte el de la especie base).
            'wikidexVarietyFlavorText' => $this->wikidexVarietyFlavorTextRepository->findTextByPokemonName($payload['name']),
            // Mismo fallback pero para el "== Efecto ==" de habilidades/movimientos
            // (ver .claude/memory/project_pokewebmax_progress.md, "paridad total") —
            // solo las de este Pokémon en concreto, no las ~1100 importadas enteras.
            'wikidexEffectText' => [
                'ability' => $this->filterByIds($this->wikidexEffectTextRepository->findTextsByType('ability'), $abilities),
                'move' => $this->filterByIds($this->wikidexEffectTextRepository->findTextsByType('move'), $moves),
            ],
            'missing' => [
                'species' => $species === null,
                'evolutionChain' => $evolutionChain === null,
                'moves' => $this->countMissing($moves),
                'abilities' => $this->countMissing($abilities),
                'forms' => $this->countMissing($forms),
            ],
        ];
    }

    private const ROMAN_GENERATIONS = [
        'i' => 1, 'ii' => 2, 'iii' => 3, 'iv' => 4, 'v' => 5,
        'vi' => 6, 'vii' => 7, 'viii' => 8, 'ix' => 9,
    ];

    /**
     * `version-group` de DLC → su juego base — pedido explícitamente por David
     * 2026-08-24: los DLC no se ofrecen como opción propia en el selector, cuentan
     * como el juego al que pertenecen (ver resolveVersionMeta()). Lista cerrada a
     * mano (mismo criterio que ROMAN_GENERATIONS/TYPE_NAMES_ES — dominio pequeño y de
     * crecimiento lento, no vale la pena inferirlo por heurística). 'mega-dimension'
     * confirmado por David como DLC de Legends Z-A pese a no llevar el prefijo
     * "Legends Z-A:" en su nombre (a diferencia de los demás, que sí llevan
     * "Espada: <DLC>"/"Escarlata: <DLC>" — Legends Z-A es un único juego, no
     * dos versiones, así que no hay prefijo que desambiguar).
     */
    private const DLC_PARENT_VERSION_GROUPS = [
        'the-isle-of-armor' => 'sword-shield',
        'the-crown-tundra' => 'sword-shield',
        'the-teal-mask' => 'scarlet-violet',
        'the-indigo-disk' => 'scarlet-violet',
        'mega-dimension' => 'legends-za',
    ];

    /**
     * `version-group` que nunca se ofrecen como opción en el selector, y que
     * tampoco se pliegan sobre ningún juego (a diferencia de DLC_PARENT_VERSION_GROUPS)
     * — pedido explícitamente por David 2026-08-24:
     * - `red-green-japan`/`blue-japan`: ediciones japonesas originales de Gen I: la
     *   Pokédex de Kanto ya la cubren `red-blue`/`yellow`/`firered-leafgreen`
     *   (comparten la misma Pokédex 'kanto'), así que ocultarlas no pierde ningún
     *   Pokémon del selector, solo quita el duplicado.
     * - `champions`: pokédex propia ('champions') sin relación con ningún juego
     *   tradicional cacheado — David confirmó que no hace falta incluirlo ("solo se
     *   incluyen juegos tradicionales").
     */
    private const EXCLUDED_VERSION_GROUPS = ['red-green-japan', 'blue-japan', 'champions'];

    /**
     * `version` → `{versionGroup, generation}` para cada juego en el que esta especie
     * aparece — resuelto con findVersionGroupCatalog() (ver
     * PokeApiResourceCacheRepository), sin ninguna llamada nueva a PokeAPI. El
     * criterio principal es `species.pokedex_numbers` (número de Pokédex regional,
     * dato extraído directamente del juego) cruzado contra las Pokédex de cada
     * version-group, NO `species.flavor_text_entries`: se comprobó con datos reales
     * (2026-08-23) que PokeAPI tiene el texto de Pokédex sin transcribir para muchos
     * Pokémon "veteranos" en juegos recientes (ej. Pikachu no tiene flavor text de
     * Escarlata/Púrpura pese a estar confirmado en la Pokédex de Paldea con el nº 74),
     * así que basarse solo en flavor_text_entries dejaba esos juegos fuera del
     * selector aunque el Pokémon sí estuviera en ellos. Se mantiene un fallback por
     * flavor_text_entries de todos modos (unión, no sustituye al de arriba) por si
     * algún version-group raro tuviera texto pero, por lo que sea, ninguna Pokédex
     * asociada en el payload.
     *
     * El cruce de arriba es a nivel de ESPECIE (`species.pokedex_numbers` no distingue
     * variante/forma — Raichu base y Raichu-Alola comparten la misma entrada de
     * Pokédex de Kanto), así que sin más correctivo cualquier forma regional/mega/
     * gigamax heredaría también los juegos de generaciones anteriores a su propia
     * introducción (bug real detectado 2026-08-24: la ficha de `raichu-alola` ofrecía
     * Rojo/Azul/Amarillo, generación I, donde Alola ni existía). Corregido con un
     * **suelo de generación** sacado de `pokemon-form.version_group` de ESTA variante
     * en concreto (dato ya cacheado, sin llamada nueva): se descarta cualquier juego
     * de una generación anterior a la de introducción de la forma. No es perfecto (no
     * distingue, p.ej., si una forma regional reaparece de verdad en un remake
     * concreto de generación posterior o no) pero elimina el caso claramente roto.
     * Si la `pokemon-form` de esta variante no está cacheada, no se aplica ningún
     * suelo (mismo comportamiento de antes — fail open, no ocultar de más).
     *
     * El frontend usa este mapeo para saber a qué version_group/generación filtrar
     * movimientos, evolución, tipos, stats y habilidades cuando se elige un juego
     * concreto en la ficha — y para qué juegos mostrar siquiera como opción.
     *
     * Los DLC (`DLC_PARENT_VERSION_GROUPS`) no aparecen nunca como entrada propia:
     * si la especie solo coincide por el DLC (no por el juego base), se resuelve en
     * dos pasadas — primero los version-group "normales" (todo lo que no sea DLC ni
     * esté en `EXCLUDED_VERSION_GROUPS`), después los DLC, que solo añaden sus juegos
     * base si esos juegos no quedaron ya cubiertos en la primera pasada. Se les
     * atribuye el `versionGroup` del PROPIO DLC (no el del juego base) porque el
     * dato real de movimientos/evolución de un Pokémon exclusivo de DLC está
     * etiquetado en el payload con el `version_group` del DLC (ej.
     * `the-crown-tundra`), no con el del juego base (`sword-shield`) — atribuir el
     * del juego base habría dejado el filtrado de movimientos vacío para esos casos.
     *
     * @param array $speciesPayload payload crudo de `pokemon-species`
     * @param array $pokemonPayload payload crudo de `pokemon` (la variante concreta pedida)
     * @return array<string, array{versionGroup: string, generation: ?int}>
     */
    private function resolveVersionMeta(array $speciesPayload, array $pokemonPayload): array
    {
        $pokedexNames = array_map(
            static fn (array $p) => $p['pokedex']['name'],
            $speciesPayload['pokedex_numbers'] ?? [],
        );
        $flavorTextVersionNames = array_unique(array_map(
            static fn (array $e) => $e['version']['name'],
            $speciesPayload['flavor_text_entries'] ?? [],
        ));
        $catalog = $this->repository->findVersionGroupCatalog();
        $minGeneration = $this->resolveVarietyMinGeneration($pokemonPayload, $catalog);

        $matchesGroup = function (array $info) use ($pokedexNames, $flavorTextVersionNames): bool {
            $matchesPokedex = array_intersect($info['pokedexes'], $pokedexNames) !== [];
            $matchesFlavorText = array_intersect($info['versions'], $flavorTextVersionNames) !== [];

            return $matchesPokedex || $matchesFlavorText;
        };
        $passesFloor = function (?int $generation) use ($minGeneration): bool {
            return $minGeneration === null || $generation === null || $generation >= $minGeneration;
        };

        $meta = [];
        foreach ($catalog as $groupName => $info) {
            if (in_array($groupName, self::EXCLUDED_VERSION_GROUPS, true) || isset(self::DLC_PARENT_VERSION_GROUPS[$groupName])) {
                continue;
            }
            $generation = self::romanGeneration($info['generation']);
            if (!$matchesGroup($info) || !$passesFloor($generation)) {
                continue;
            }
            foreach ($info['versions'] as $versionName) {
                $meta[$versionName] = ['versionGroup' => $groupName, 'generation' => $generation];
            }
        }

        foreach (self::DLC_PARENT_VERSION_GROUPS as $dlcGroupName => $parentGroupName) {
            $dlcInfo = $catalog[$dlcGroupName] ?? null;
            $parentInfo = $catalog[$parentGroupName] ?? null;
            if ($dlcInfo === null || $parentInfo === null) {
                continue;
            }
            $generation = self::romanGeneration($dlcInfo['generation']);
            if (!$matchesGroup($dlcInfo) || !$passesFloor($generation)) {
                continue;
            }
            foreach ($parentInfo['versions'] as $versionName) {
                if (!isset($meta[$versionName])) {
                    $meta[$versionName] = ['versionGroup' => $dlcGroupName, 'generation' => $generation];
                }
            }
        }

        return $meta;
    }

    /**
     * Generación de introducción de esta variante concreta (`pokemon.forms[0]`, la
     * `pokemon-form` propia de esta forma) — ver resolveVersionMeta() para el porqué.
     *
     * @param array<string, array{generation: ?string, pokedexes: string[], versions: string[]}> $catalog
     */
    private function resolveVarietyMinGeneration(array $pokemonPayload, array $catalog): ?int
    {
        $formRef = $pokemonPayload['forms'][0] ?? null;
        $form = $formRef !== null ? $this->resolveOne('pokemon-form', $formRef['url'] ?? null) : null;
        $versionGroupName = $form?->getPayload()['version_group']['name'] ?? null;

        return $versionGroupName !== null
            ? self::romanGeneration($catalog[$versionGroupName]['generation'] ?? null)
            : null;
    }

    private static function romanGeneration(?string $generationName): ?int
    {
        $roman = $generationName !== null ? explode('-', $generationName)[1] ?? null : null;

        return $roman !== null ? (self::ROMAN_GENERATIONS[$roman] ?? null) : null;
    }

    private function resolveOne(string $resourceType, ?string $url): ?PokeApiResourceCache
    {
        if ($url === null) {
            return null;
        }

        return $this->repository->findByTypeAndIdOrName($resourceType, (string) PokeApiUrl::idFromUrl($url));
    }

    /**
     * @param array<int, array{name: string, url: string}> $refs
     * @return array<int, array{id: int, name: string, cached: bool, payload: ?array}>
     */
    private function resolveMany(string $resourceType, array $refs): array
    {
        return array_map(function (array $ref) use ($resourceType) {
            $id = PokeApiUrl::idFromUrl($ref['url']);
            $cached = $this->repository->findByTypeAndIdOrName($resourceType, (string) $id);

            return [
                'id' => $id,
                'name' => $ref['name'],
                'cached' => $cached !== null,
                'payload' => $cached?->getPayload(),
            ];
        }, $refs);
    }

    private function countMissing(array $resolvedMany): int
    {
        return count(array_filter($resolvedMany, static fn (array $entry) => !$entry['cached']));
    }

    /**
     * @param array<int, string> $textById
     * @param array<int, array{id: int}> $resolvedMany
     * @return array<int, string>
     */
    private function filterByIds(array $textById, array $resolvedMany): array
    {
        $ids = array_column($resolvedMany, 'id');

        return array_intersect_key($textById, array_flip($ids));
    }
}
