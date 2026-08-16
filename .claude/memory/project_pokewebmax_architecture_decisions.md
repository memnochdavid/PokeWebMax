---
name: project_pokewebmax_architecture_decisions
description: Decisiones de arquitectura de PokeWebMax y en qué difiere deliberadamente de la app Android de referencia
metadata:
  type: project
---

1. **Symfony como proxy + caché, no como dueño del modelo de datos.** A diferencia de
   ZenPaw (donde Symfony es la fuente de verdad de un CRUD normal), aquí el dato "real"
   vive en PokeAPI v2 (y más adelante WikiDex). Symfony reenvía/cachea, no inventa datos
   propios salvo metadatos de caché. Las entidades Doctrine que se creen son el
   equivalente a las 5 tablas Room del Android (`pokemon_summary`, `move_summary`,
   `item_summary`, `berry_summary`, `wikidex_cache`), ver
   [[project_pokewebmax_overview]].

2. **Cacheo MANUAL, no automático.** La app Android cachea de forma transparente y
   automática cada vez que el usuario navega. Aquí, David quiere una función/comando
   explícito que dispare la descarga desde PokeAPI v2 y la meta en la BD de Symfony —
   decisión explícita suya, no un descuido. **Why:** quiere control directo sobre cuándo
   se puebla la caché, probablemente para ir construyendo el dataset a su ritmo mientras
   aprende. **How to apply:** cuando se implemente esa función, que sea un comando de
   consola (`bin/console app:cache:...`) o un endpoint explícito, nunca cacheo implícito
   en cada GET.

3. **Todo dentro de Docker, nada en el host** — mismo patrón que
   `[[project_zenpaw_architecture_decisions]]` (memoria de otro proyecto, ZenPaw): ni
   Composer ni Node/npm instalados en la máquina.

4. **Sin autenticación por ahora.** No se ha pedido sistema de usuarios. Si en el futuro
   se aborda "favoritos/equipos" (pendiente incluso en el Android, ver
   `docs/reference-android/mejoras-pendientes.md` sección 1.2), ahí sí haría falta.
   No añadir security-bundle/JWT hasta que se pida explícitamente.

5. **CSS Modules en vez de Tailwind** — mismo criterio que ZenPaw, nativo en Vite.

6. **Puertos distintos a ZenPaw** para poder tener ambos proyectos corriendo a la vez sin
   colisión: backend `8001`, frontend `5174`, MariaDB `3307` (ZenPaw usa 8000/5173/3306).
   Contenedores con prefijo `pokewebmax_` en vez de `zenpaw_`.

7. **React: custom hooks obligatorios para lógica de datos.** Ningún componente `.jsx`
   debe contener `useState`/`useEffect`/`useCallback`/llamadas a `axios` inline en su
   cuerpo — esa lógica se extrae siempre a un hook propio en `src/hooks/useNombre.js`. El
   componente se queda solo con composición y JSX. **Why:** máxima explícita de David
   ("se deben usar hooks para no ensuciar el código"), tras ver el patrón aplicado en
   `useServiceHealth.js` (extraído de `App.jsx`). **How to apply:** aplicar desde el
   primer borrador de cualquier componente nuevo, no esperar a que lo señale.

8. **Caché genérica por tipo de recurso, no una tabla por recurso.** PokeAPI tiene ~50
   recursos (`pokemon-species`, `move`, `item`, `berry`, `ability`, `type`, `nature`...).
   En vez de una entidad Doctrine por recurso (lo que implicaría 50 migraciones y 50
   mappers a la larga), hay una única tabla `pokeapi_resource_cache`
   (`App\Entity\PokeApiResourceCache`): `resourceType` + `resourceId` + `name` +
   `payload` (columna JSON con la respuesta cruda de PokeAPI, sin parsear a columnas
   propias) + `fetchedAt`. Todo el código de cacheo (`PokeApiCacheService`,
   `PokeApiListService`, `PokeApiClient::fetchResource()/fetchResourceList()`) está
   parametrizado por `resourceType` en vez de duplicarse por recurso. **Why:** decisión
   explícita de David ante "asume que vamos a cachear la api completa" — con ese alcance,
   una entidad tipada por recurso habría sido masivamente repetitivo; la tabla genérica
   permite añadir un recurso nuevo (#6, #7...) sin entidad ni migración nueva, solo un
   `resourceType` más. Encaja además con la decisión 1 (Symfony no inventa modelo propio,
   solo cachea lo que ya viene de PokeAPI — guardar el JSON tal cual es literal a eso).
   **How to apply:** al añadir un recurso nuevo, NO crear una entidad Doctrine — solo usar
   el `resourceType` correspondiente contra los servicios/endpoints genéricos existentes
   (`GET /api/pokeapi/{resourceType}`, `POST /api/pokeapi/{resourceType}/cache/{idOrName}`,
   comando `app:cache:resource {resourceType} {idOrName}`). Si una vista concreta necesita
   datos derivados del payload (tipos de un Pokémon, poder de un movimiento...), ese
   parseo vive en el consumidor (controlador/frontend), no en el modelo de caché.
   Los 49 recursos reales de PokeAPI (todo salvo `meta`) están dados de alta en el
   frontend en `RESOURCE_GROUPS` (`frontend/src/utils/pokeApiResources.js`) — David pidió
   explícitamente "añade todo" tras ver los primeros 5, no se quedó ningún recurso fuera
   por decisión de alcance.
   **Cuidado con el coste de leer en bloque:** 5 de esos 49 recursos no tienen `name` en
   PokeAPI (`contest-effect`, `super-contest-effect`, `evolution-chain`, `machine`,
   `characteristic`) — se usa un nombre sintético `{resourceType}-{id}`. Y cualquier query
   que traiga varias filas de `pokeapi_resource_cache` debe seleccionar solo las columnas
   que hagan falta (ver `findFetchedAtByType`), nunca `findBy`/`findAll` sin proyección —
   con recursos de miles de filas y `payload` grande (`pokemon-species` ~28MB en total),
   hidratar las entidades completas agota el `memory_limit` de PHP (bug real, visto y
   arreglado en `project_pokewebmax_progress.md`).

9. **La ficha de Pokémon NO necesita tablas tipadas — se compone en el backend leyendo
   la caché genérica por id/url conocido, nunca por filtro.** David cuestionó la tabla
   genérica única del punto 8 por "antiintuitiva" (2026-08-16); se reevaluó mirando el
   código real de `github.com/memnochdavid/Dexter.git` (la app Android, no los docs
   congelados de `docs/reference-android/` — esos describen 11 pestañas propuestas por
   un consultor UX que nunca se implementaron; el código real tiene 7:
   `DESC, EVOS, STATS, MOVES, ABILITY, INTER, FORM`, ver `FichaDesplegables.kt`). Cada
   pestaña resuelve datos por id/url exacto conocido (species por `pokemon.species.url`,
   cada movimiento/habilidad por su url, cadena evolutiva por
   `species.evolution_chain.url`...) — nunca "todos los que cumplan X". Ese patrón
   confirma que la tabla genérica basta para la ficha: no hace falta esquema nuevo, solo
   una capa de composición. Implementado como `PokemonFichaAssembler` (lee de
   `pokeapi_resource_cache`, nunca llama a PokeAPI, marca cada pieza no cacheada con
   `cached: false` y un resumen `missing` por sección) +
   `PokemonFichaController::ficha()` (`GET /api/pokemon/{idOrName}/ficha`). Las tablas
   tipadas del punto 8 siguen reservadas solo para navegadores con filtro real
   (Movimientos por tipo, Items por categoría...), que son pantallas aparte todavía no
   construidas. **Why:** evita repetir el error de sobre-diseñar el esquema antes de
   saber qué patrón de acceso necesita cada vista — la ficha resultó no necesitarlo.
   **How to apply:** antes de proponer una tabla tipada para una vista nueva, comprobar
   primero si esa vista accede por id conocido (→ caché genérica + composición) o por
   filtro sobre un campo interno (→ ahí sí tabla tipada).

10. **Cacheo de "lo que falte" para una ficha concreta SÍ es una acción manual válida,
    no cacheo implícito.** A raíz de lo anterior, David pidió un botón en la ficha que
    cachee de un tirón todo lo que le falte (species, evolution-chain, moves,
    abilities, forms) más un indicador por pestaña de cuánto le falta. Esto no
    contradice la decisión 2 (cacheo manual): sigue siendo un clic explícito del
    usuario, solo que dispara varias piezas relacionadas en vez de una. Implementado
    como `PokemonFichaCacheService::cacheMissing()` (`POST
    /api/pokemon/{idOrName}/ficha/cache-missing`) — reutiliza
    `PokeApiCacheService::cache()` pieza por pieza (que ya es idempotente, así que no
    hace falta precalcular qué falta: pedir todo y lo ya cacheado no cuesta HTTP).
    **How to apply:** este patrón ("botón que cachea todo lo que le falta a ESTA
    vista concreta") es el que replicar cuando se construyan los navegadores de
    Movimientos/Items/Regiones, en vez de forzar al usuario a ir a `/cache` a cachear
    el recurso genérico entero.

11. **Diseño visual de cards portado de `DexterWeb`** (repo anterior de David,
    `github.com/memnochdavid/DexterWeb.git`, revisado también en la sesión de
    2026-08-15 por el diseño de caché). De ahí: `typeColors.js` → adaptado a
    `frontend/src/utils/pokemonTypes.js` (colores hex por tipo + nombres en español +
    resolución de icono SVG vía `new URL(..., import.meta.url)`), los 18 SVG de tipo →
    `frontend/src/assets/types/`, y el patrón de card horizontal con gradiente por tipo
    dual (`PokemonCardLista.jsx`/`.css`) → `components/PokemonCard/` +
    `components/TypeBadge/`. `PokemonCard` es genérico (acepta `types=[]` y cae a un
    gradiente gris neutro si no hay tipos) para poder reusarse tanto en `/ficha` (que sí
    tiene tipos, vienen del recurso `pokemon`) como en `/pokemon` (que todavía no los
    tiene — ver nota de "tipos perdidos" en `project_pokewebmax_progress.md`).

**How to apply (general):** antes de añadir cualquier dependencia o patrón "porque el
Android lo tiene así", confirmar con David si ya toca esa fase — ver
`project_pokewebmax_progress.md`.
