# Mejoras pendientes — Dexter Pokedex

Auditoría del estado actual de la app y propuestas de mejora priorizadas por impacto.
Última revisión: 2026-04-05

---

## 1. Impacto alto — lo que el usuario nota

### 1.1 Gestión de errores visible
Los fallos de red son silenciosos: el usuario ve pantallas vacías sin saber por qué. Solo existe un `_error: MutableLiveData<String?>` que rara vez se muestra en la UI.

**Qué hacer:**
- Crear `sealed class UiState<T>` (Loading, Success, Error) para cada operación.
- Añadir UI de error con botón de reintento en cada pantalla (detalle, listas, movimientos).
- Banner de "sin conexión" cuando no hay red.
- Loguear errores de API con `Log.e()` en lugar de `catch (_: Exception) {}`.

**Archivos afectados:** `PokemonViewModel.kt`, todos los composables de pantalla.

---

### 1.2 Favoritos / Equipo
No hay forma de guardar Pokémon. Es la feature más esperada en una Pokédex.

**Qué hacer:**
- Nueva tabla Room `favorites` con el ID del Pokémon y timestamp.
- Icono de corazón/estrella en la ficha y en las tarjetas de lista.
- Pantalla/sección de favoritos accesible desde la navegación principal.
- Opcional: permitir crear "equipos" de 6.

**Archivos afectados:** `PokemonDao.kt`, `DexterDatabase.kt`, nueva UI.

---

### 1.3 Matriz general de tipos (standalone)
Ya existe una tabla de debilidades/resistencias/inmunidades **por Pokémon** en el tab "Tipos" de la ficha (`Interacciones.kt`). Lo que falta es una **pantalla independiente** con la matriz completa tipo-vs-tipo (18x18), accesible desde la navegación principal como referencia rápida sin necesidad de abrir la ficha de un Pokémon concreto.

**Qué hacer:**
- Nueva pantalla con grid scrollable horizontal+vertical de 18x18 tipos.
- Celdas coloreadas por efectividad (x0, x0.5, x1, x2).
- Accesible desde navegación principal (sección "Extras" o nueva entrada).
- La lógica de multiplicadores ya existe en `Util.kt`.

**Archivos afectados:** `Util.kt` (lógica existente), nueva pantalla, navegación.

---

### 1.4 Paginación en las listas
Cada generación carga todos los Pokémon de golpe. En generaciones grandes (Gen V: 156, Gen VIII: 96+) el tiempo de carga inicial es notable.

**Qué hacer:**
- Implementar Paging3 para carga incremental.
- Mantener caché Room como source of truth.
- Skeleton/shimmer mientras se cargan los siguientes items.

**Archivos afectados:** `PokemonViewModel.kt`, composables de lista.

---

### 1.5 Pull-to-refresh
No existe en ninguna lista. Si algo falla al cargar, no hay forma de reintentar sin salir y volver a entrar.

**Qué hacer:**
- Añadir `pullRefresh` modifier en las listas principales (Pokémon, Movimientos, Objetos).
- Al hacer pull, invalidar caché y recargar.

---

## 2. Impacto medio — calidad y mantenibilidad

### 2.1 ViewModel monolítico (1.150+ líneas)
`PokemonViewModel` maneja todo: listas, detalle, movimientos, objetos, bayas, regiones, encuentros, cadenas evolutivas, formas, WikiDex.

**Qué hacer:**
- Partir en ViewModels especializados:
  - `PokemonListViewModel` — lista, búsqueda, filtros, generaciones.
  - `PokemonDetailViewModel` — detalle, encuentros, evolución, formas.
  - `MoveBrowserViewModel` — listado y filtrado de movimientos.
  - `ItemBrowserViewModel` — objetos y bayas.
- Compartir estado común via repositorios inyectados.

**Archivos afectados:** `PokemonViewModel.kt` (dividir), todas las pantallas (actualizar inyección).

---

### 2.2 Mezcla de LiveData y StateFlow
Parte del estado usa `MutableLiveData` y parte `MutableStateFlow`. Esto crea inconsistencia en cómo se consume desde Compose.

**Qué hacer:**
- Migrar todo a `StateFlow` + `stateIn()`.
- En Compose usar `collectAsStateWithLifecycle()` uniformemente.
- Eliminar dependencia de `livedata-ktx` si ya no se usa.

---

### 2.3 Strings hardcodeados
"Nivel", "Intercambio", "No se encuentra en estado salvaje", nombres de tipos en español... todo está inline en los composables.

**Qué hacer:**
- Mover todos los textos visibles a `strings.xml`.
- Agrupar por pantalla/feature.
- Esto habilita localización futura (inglés, portugués, etc.).

**Archivos afectados:** Prácticamente todos los composables.

---

### 2.4 Expiración de caché WikiDex
El campo `fetchedAtMillis` se guarda en `WikiDexCacheEntity` pero nunca se consulta. Si WikiDex actualiza información, los usuarios nunca lo verían.

**Qué hacer:**
- Al leer la caché, comprobar si `fetchedAtMillis` tiene más de 30 días.
- Si está expirada, re-descargar en background y actualizar.
- Mantener los datos viejos mientras se descarga (stale-while-revalidate).

**Archivos afectados:** `WikiDexRepository.kt`.

---

### 2.5 Código muerto y dependencias sobrantes
Hay imports comentados de Camera, ML Kit, Appwrite, alternativas de ExoPlayer. También se incluyen Ktor y ExoPlayer 2.x junto a Media3, sin claridad sobre cuál se usa.

**Qué hacer:**
- Eliminar todos los bloques comentados.
- Auditar `build.gradle.kts`: quitar dependencias no usadas.
- Unificar en Media3 (quitar ExoPlayer 2.x legacy).

---

## 3. Impacto bajo — polish

### 3.1 Accesibilidad
Varios `contentDescription = null` en imágenes interactivas. Elementos sin semántica para TalkBack.

**Qué hacer:**
- Añadir `contentDescription` descriptivo a todas las imágenes.
- Usar `Modifier.semantics {}` en elementos interactivos complejos.
- Testear con TalkBack activado.

**Archivos afectados:** `PokemonCard.kt`, composables de ficha.

---

### 3.2 Dark mode inconsistente
El tema Material3 está configurado con `DarkColorScheme` / `LightColorScheme`, pero muchos colores están hardcodeados (`Color(0xFF...)`) directamente en los composables.

**Qué hacer:**
- Reemplazar colores hardcodeados por tokens de `MaterialTheme.colorScheme`.
- Los colores de tipo Pokémon pueden mantenerse custom, pero fondos, textos y superficies deberían usar el tema.

---

### 3.3 Comparador de Pokémon
Poder poner dos Pokémon lado a lado (stats, tipos, movimientos) sería un diferencial respecto a otras Pokédex.

**Qué hacer:**
- Pantalla de comparación con selector dual.
- Gráfico de radar superpuesto para stats base.
- Tabla de tipos lado a lado.

---

### 3.4 Skeleton loaders
Actualmente solo hay spinner Lottie (Pokéball). Shimmer/skeletons en las listas darían un aspecto más moderno durante cargas.

**Qué hacer:**
- Crear composable `SkeletonCard` que imite la forma de `PokemonCard`.
- Usar `shimmer` modifier con gradiente animado.
- Mostrar N skeletons mientras `isLoading == true`.

---

### 3.5 Tests
No hay tests visibles (ni unitarios ni de UI). Los parsers de WikiDex y la lógica del ViewModel son especialmente frágiles sin cobertura.

**Qué hacer:**
- Tests unitarios para: `WikiDexParser`, `WikiDexGameMapper`, `romanToInt`, lógica de filtrado.
- Tests de integración para: `WikiDexRepository` con HTML de ejemplo.
- Tests de UI con Compose Testing para flujos críticos.

---

## Notas técnicas de referencia

| Métrica | Valor actual |
|---|---|
| LOC total (Kotlin) | ~17.100 |
| Líneas ViewModel principal | 1.150+ |
| Tablas Room | 5 (Pokemon, Move, Item, Berry, WikiDexCache) |
| Endpoints PokeAPI usados | 30+ |
| Tests | 0 |
| Strings en strings.xml | Solo `app_name` |
