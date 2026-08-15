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

**How to apply (general):** antes de añadir cualquier dependencia o patrón "porque el
Android lo tiene así", confirmar con David si ya toca esa fase — ver
`project_pokewebmax_progress.md`.
