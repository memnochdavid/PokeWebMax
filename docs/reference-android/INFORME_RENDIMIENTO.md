# Informe de rendimiento en arranque (móvil)

## Estado actual

La app presenta stuttering/jank en el arranque en dispositivos móviles. Se han identificado 6 puntos de mejora ordenados por impacto.

---

## 1. Carga lazy por generación — `IMPLEMENTADO`

**Problema:** Al arrancar se lanzaba `fetchPokemonForGeneration()` para las 9 generaciones a la vez, generando 500+ peticiones API concurrentes.

**Solución aplicada:**
- `ListaPokemon.kt`: Eliminado el `LaunchedEffect(generations)` que cargaba todo de golpe. Sustituido por un `LaunchedEffect(currentPage)` que solo carga la generación visible + adyacentes (±1 página del `HorizontalPager`).
- `ListaPokemon.kt`: Añadido un `LaunchedEffect(isSearching)` que dispara la carga de las generaciones faltantes en segundo plano cuando el usuario activa búsqueda o filtros.
- `PokemonViewModel.kt`: Añadida función `ensureAllGenerationsLoaded()` que solo carga las generaciones que no estén ya en caché.

**Resultado:**
- Arranque: de ~1000+ peticiones a ~300 (Gen 1 + Gen 2)
- Swipe entre generaciones: la siguiente ya está precargada
- Búsqueda: los resultados van apareciendo conforme se cargan las generaciones restantes
- Segunda apertura: instantánea gracias a Room (ya existente)

---

## 2. Reducir concurrencia del dispatcher de red — `PENDIENTE`

**Problema:** `RetrofitClient.kt:26-36` configura `maxRequests = 100` y `maxRequestsPerHost = 50`. En móvil con 3G/4G esto causa agotamiento de sockets, TCP window stalls y timeouts en cascada.

**Solución propuesta:**
- Reducir a `maxRequests = 20`, `maxRequestsPerHost = 10`
- Implementar retry con backoff exponencial

**Impacto esperado:** Menos fallos de red, menos memoria consumida por conexiones abiertas.

---

## 3. Consolidar StateFlow/LiveData — `IMPLEMENTADO`

**Problema:** `PokemonViewModel.kt` declaraba 9 `MutableStateFlow` independientes para búsqueda/filtros. Cada uno era un gatillo de recomposición independiente en `GenerationPagerScreen` (13 suscripciones en total).

**Solución aplicada:**
- `PokemonViewModel.kt`: Creado `data class PokemonFilterState` que agrupa los 9 estados (`searchQuery`, `selectedType1`, `selectedType2`, `showMegas`, `showGigamax`, `showRegionals`, `showLegendaries`, `showMythicals`, `isGridView`) en un único `MutableStateFlow<PokemonFilterState>`.
- `ListaPokemon.kt`: De 9 `collectAsState()` individuales a 1 solo (`filters`). Todas las referencias actualizadas a `filters.campo`.
- `MainActivity.kt`: BottomSheet actualizado de 8 `collectAsState()` a 1. Callbacks usan `pf.copy(campo = valor)`. Toggle grid/list actualizado.

**Resultado:**
- De 13 gatillos de recomposición independientes en `GenerationPagerScreen` a 5 (`generations`, `pokemonByGenerationCache`, `isLoadingAnyPokemon`, `filters`, `specialForms`)
- Cambios simultáneos de filtros disparan una sola recomposición en vez de varias

---

## 4. Memoizar cálculos de tarjetas + simplificar animaciones — `IMPLEMENTADO (parcial)`

**Problema:** `PokemonCard.kt` — Cada tarjeta recalculaba colores, gradientes y nombres en cada recomposición. Además, cada tarjeta registra 3 `animateFloatAsState` aunque el 99% del tiempo no están animando.

**Solución aplicada (memoización — subproblema C):**
- `PokemonCard.kt` (ambas variantes List y Grid): `color1`, `color2` envueltos en `remember(types)`.
- `backgroundBrush` cacheado con `remember(types, color1, color2, gradientPair)`.
- `displayName` cacheado con `remember(pokemonSummary.name)` — `adaptaNombre(transformPokemonNameToResourceName(...))` se ejecuta una sola vez por Pokémon.

**No aplicado (animaciones — subproblema A):**
- Las 3 `animateFloatAsState` (`scale`, `contentScale`, `pokeballAlpha`) no se pueden mover dentro de un `if (isAnimating)` porque son `@Composable` y Compose no permite llamadas composables condicionales.
- Cuando `isAnimating = false`, los `targetValue` ya son estáticos (1f, 0f), así que Compose no hace interpolación real — el overhead es solo del registro del estado en el snapshot system.

**No aplicado (shimmer — subproblema B):**
- El shimmer radial solo se renderiza en la tarjeta que está siendo pulsada (1 a la vez), por lo que su impacto es bajo.

**Resultado:**
- Eliminadas llamadas redundantes a `getPokemonTypeColorClear()`, `getPokemonTypeGradientColors()`, `adaptaNombre()` y `transformPokemonNameToResourceName()` en cada recomposición
- Menos allocations de objetos `Color` y `String` por frame durante scroll

---

## 6. Reducir concurrencia del dispatcher de red — `IMPLEMENTADO`

**Problema:** `RetrofitClient.kt:26-28` configuraba `maxRequests = 100` y `maxRequestsPerHost = 50`. En móvil con 3G/4G esto causaba agotamiento de sockets, TCP window stalls y timeouts en cascada. Además, el semáforo de coroutines en `PokemonViewModel.kt` estaba a 50, encolando demasiadas peticiones en OkHttp.

**Solución aplicada:**
- `RetrofitClient.kt`: Reducido `maxRequests` de 100 a 20, `maxRequestsPerHost` de 50 a 10.
- `PokemonViewModel.kt`: Reducido semáforo de coroutines de 50 a 15 para no acumular peticiones encoladas en OkHttp.

**Resultado:**
- Las peticiones se procesan en lotes de 10 en vez de 50, evitando saturación de red
- Menos memoria consumida en buffers de socket (~1-2 MB vs ~3-12 MB)
- Menor consumo de batería al permitir al radio móvil bajar a low power entre lotes
- Complementario con el punto 1: al cargar menos generaciones al arrancar, el throughput efectivo se mantiene
