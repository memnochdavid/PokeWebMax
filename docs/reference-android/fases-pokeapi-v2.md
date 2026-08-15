# Plan de implementacion completa de PokeAPI v2

## Estado actual

La app Dexter ya consume varios endpoints de la PokeAPI v2. Este documento detalla que esta hecho, que falta, y como abordarlo por fases.

---

## Endpoints ya implementados

| Endpoint | Uso actual |
|----------|-----------|
| `pokemon/{name\|id}` | Ficha detallada del Pokemon |
| `pokemon-species/{name\|id}` | Nombre localizado, descripcion, cadena evolutiva, habitat, color, genero, egg groups, growth rate |
| `pokemon-form/{name\|id}` | Formas regionales y variantes |
| `evolution-chain/{url}` | Cadena evolutiva completa con condiciones |
| `type`, `type/{name\|id}` | Tipos, relaciones de dano |
| `move/{url}` | Detalles de movimiento (en ficha Pokemon) |
| `ability/{url}` | Detalles de habilidad (en ficha Pokemon) |
| `generation`, `generation/{id}` | Lista de generaciones y Pokemon por generacion |
| `item/{url}` | Items de evolucion (solo en contexto evolutivo) |
| `move?limit=2000` | Lista completa de movimientos (navegador) |
| `pokemon/{id}/encounters` | Ubicaciones donde encontrar al Pokemon |

---

## FASE 1 - Navegador de Movimientos (COMPLETADA)

### Que se hizo
- Nueva pantalla `MoveBrowserScreen` con lista completa de ~900 movimientos
- Buscador por nombre (espanol/ingles)
- Filtro por tipo (18 tipos)
- Filtro por clase de dano (fisico/especial/estado)
- Cards expandibles con descripcion
- Navegacion con BottomBar (Pokemon | Movimientos)
- Carga paralela por lotes con semaforo de concurrencia

### Archivos creados/modificados
- `ui/screen/movimientos/NavegadorMovimientos.kt` (NUEVO)
- `api/service/PokeApiService.kt` - endpoints `GET /move`, `GET /move/{id}`, `GET /move/{name}`
- `api/model/PokemonAPI.kt` - modelos `MoveListResponse`, `MoveSummary`
- `api/viewModel/PokemonViewModel.kt` - funciones `fetchMoveList()`, `fetchMoveSummariesBatch()`
- `MainActivity.kt` - BottomBar con navegacion entre tabs

---

## FASE 2 - Enriquecer la ficha del Pokemon (COMPLETADA)

### Que se hizo
- Nueva pestaña "Ubic." (Ubicaciones/Encuentros) en la ficha del Pokemon
- Endpoint `pokemon/{id}/encounters` para obtener donde se encuentra cada Pokemon
- Cada ubicacion muestra: nombre localizado, versiones del juego, metodo de encuentro, niveles y probabilidad
- Barra visual de probabilidad con colores (verde/amarillo/naranja/rojo)
- Cards expandibles por ubicacion con detalle por version
- Traduccion completa de nombres de versiones y metodos de encuentro al espanol
- La seccion INFO ya existente cubre: egg groups, hatch counter, growth rate, habitat, gender rate, capture rate, EVs, base happiness

### Archivos creados/modificados
- `ui/screen/ficha/composable/desplegable/Encuentros.kt` (NUEVO)
- `api/service/PokeApiService.kt` - endpoint `GET pokemon/{id}/encounters`
- `api/model/PokemonAPI.kt` - modelos `PokemonEncounterResponse`, `VersionEncounterDetail`, `EncounterDetail`, `DisplayableEncounter`, `DisplayableVersionEncounter`, `DisplayableEncounterMethod`
- `api/viewModel/PokemonViewModel.kt` - funciones `fetchPokemonEncounters()`, `translateEncounterMethod()`, `translateVersionName()`
- `ui/screen/ficha/composable/FichaDesplegables.kt` - nueva pestaña ENCOUNTERS en ContentPage
- `ui/screen/ficha/FichaPokemon.kt` - observar y pasar datos de encuentros

### Nota
La seccion INFO ya cubria la mayoria de datos de crianza (egg groups, hatch counter, growth rate, habitat, gender, capture rate, EVs, felicidad base, legendario/mitico). No se duplico contenido.

### Endpoints nuevos que quedan por cubrir (opcionales para esta fase)
| Endpoint | Dato | Donde mostrarlo |
|----------|------|-----------------|
| `pokemon/{id}/encounters` | Ubicaciones donde encontrar al Pokemon | Nueva seccion "Encuentros" en ficha |
| `characteristic/{id}` | Frase descriptiva segun stats ("Le encanta comer") | Junto a stats base |
| `nature` | 25 naturalezas y sus modificadores de stats | Nueva seccion o tooltip en stats |
| `stat/{id}` | Info detallada de cada stat (nombre localizado) | Mejorar seccion stats |
| `egg-group/{id}` | Detalles de grupo huevo (nombres localizados) | Seccion crianza |
| `growth-rate/{id}` | Curva de experiencia por nivel | Seccion crianza o nueva |

### Modelo de datos a crear
```kotlin
data class PokemonEncounter(
    val locationArea: NamedApiResource,
    val versionDetails: List<VersionEncounterDetail>
)
data class VersionEncounterDetail(
    val version: NamedApiResource,
    val maxChance: Int,
    val encounterDetails: List<EncounterDetail>
)
data class EncounterDetail(
    val minLevel: Int,
    val maxLevel: Int,
    val chance: Int,
    val method: NamedApiResource,
    val conditionValues: List<NamedApiResource>
)
data class NatureResponse(
    val id: Int,
    val name: String,
    val names: List<NameEntry>,
    val increasedStat: NamedApiResource?,
    val decreasedStat: NamedApiResource?
)
data class CharacteristicResponse(
    val id: Int,
    val geneModulo: Int,
    val possibleValues: List<Int>,
    val highestStat: NamedApiResource,
    val descriptions: List<Description>
)
```

### UI a crear
- `Encuentros.kt` - seccion desplegable con ubicaciones por version del juego
- `Crianza.kt` - egg groups, hatch counter, gender rate, growth rate (ya hay datos parciales en species)
- Mejorar `StatsBase.kt` con naturalezas y caracteristicas

### Notas de implementacion
- `pokemon/{id}/encounters` devuelve lista directamente, no un wrapper
- Las naturalezas son 25 fijas, se pueden cachear en Room
- La curva de experiencia de `growth-rate` tiene una lista de niveles con experiencia requerida

---

## FASE 3 - Navegador de Items y Bayas (COMPLETADA)

### Endpoints
| Endpoint | Descripcion |
|----------|-------------|
| `item?limit=2000` | Lista de todos los items (~1000) |
| `item/{id}` | Detalle: nombre, categoria, efecto, sprite |
| `item-category/{id}` | Categorias de items (pokeballs, medicinas, etc.) |
| `item-pocket/{id}` | Bolsillos de la mochila |
| `berry?limit=100` | Lista de bayas (~64) |
| `berry/{id}` | Detalle: firmeza, sabores, tiempo de crecimiento |
| `berry-firmness/{id}` | Firmeza de la baya |
| `berry-flavor/{id}` | Sabores y potencias |

### Modelo de datos a crear
```kotlin
data class ItemListResponse(
    val count: Int,
    val results: List<NamedApiResource>
)
// ItemDetailResponse ya existe, ampliar con:
data class ItemDetailResponseFull(
    val id: Int,
    val name: String,
    val names: List<NameEntry>,
    val cost: Int,
    val flingPower: Int?,
    val flingEffect: NamedApiResource?,
    val category: NamedApiResource,
    val effectEntries: List<VerboseEffect>,
    val flavorTextEntries: List<VersionGroupFlavorText>,
    val sprites: ItemSprites?,
    val heldByPokemon: List<ItemHolderPokemon>
)
data class BerryResponse(
    val id: Int,
    val name: String,
    val growthTime: Int,
    val maxHarvest: Int,
    val naturalGiftPower: Int,
    val naturalGiftType: NamedApiResource,
    val size: Int,
    val smoothness: Int,
    val soilDryness: Int,
    val firmness: NamedApiResource,
    val flavors: List<BerryFlavorMap>,
    val item: NamedApiResource
)
data class BerryFlavorMap(
    val potency: Int,
    val flavor: NamedApiResource
)
```

### UI a crear
- `ui/screen/items/NavegadorItems.kt` - lista de items con busqueda por nombre y filtro por categoria
- `ui/screen/items/ItemCard.kt` - card con sprite, nombre, categoria, efecto
- `ui/screen/bayas/NavegadorBayas.kt` - lista de bayas con info de sabores y crecimiento
- Anadir tabs "Items" y "Bayas" a la BottomBar (o usar un drawer/tabs dentro de la seccion)

### Notas
- Los items tienen sprites en `sprites.default` (URL directa a imagen PNG)
- Las bayas referencian un item con `berry.item`, se puede mostrar el sprite del item
- Las categorias de items son ~50, se pueden usar como filtro agrupado
- Considerar agrupar por `item-pocket` (bolsillo de mochila) como tab principal

---

## FASE 4 - Navegador de Ubicaciones y Regiones (COMPLETADA)

### Endpoints
| Endpoint | Descripcion |
|----------|-------------|
| `region?limit=100` | Regiones (~10: Kanto, Johto, etc.) |
| `region/{id}` | Detalle: nombre, generacion, pokedexes, ubicaciones |
| `location?limit=1000` | Todas las ubicaciones (~850) |
| `location/{id}` | Detalle: nombre, region, areas |
| `location-area/{id}` | Areas dentro de ubicacion con encuentros |
| `pal-park-area/{id}` | Areas del Pal Park (DPPt) |
| `pokedex/{id}` | Pokedex regionales (Nacional, Kanto, etc.) |

### Modelo de datos a crear
```kotlin
data class RegionResponse(
    val id: Int,
    val name: String,
    val names: List<NameEntry>,
    val mainGeneration: NamedApiResource,
    val locations: List<NamedApiResource>,
    val pokedexes: List<NamedApiResource>,
    val versionGroups: List<NamedApiResource>
)
data class LocationResponse(
    val id: Int,
    val name: String,
    val names: List<NameEntry>,
    val region: NamedApiResource,
    val areas: List<NamedApiResource>,
    val gameIndices: List<GenerationGameIndex>
)
data class LocationAreaResponse(
    val id: Int,
    val name: String,
    val names: List<NameEntry>,
    val location: NamedApiResource,
    val pokemonEncounters: List<PokemonEncounter>,
    val encounterMethodRates: List<EncounterMethodRate>
)
data class PokedexResponse(
    val id: Int,
    val name: String,
    val names: List<NameEntry>,
    val isMainSeries: Boolean,
    val descriptions: List<Description>,
    val pokemonEntries: List<PokemonEntry>,
    val region: NamedApiResource?,
    val versionGroups: List<NamedApiResource>
)
data class PokemonEntry(
    val entryNumber: Int,
    val pokemonSpecies: NamedApiResource
)
```

### UI a crear
- `ui/screen/regiones/NavegadorRegiones.kt` - selector de region con mapa o lista
- `ui/screen/regiones/UbicacionesRegion.kt` - ubicaciones dentro de una region
- `ui/screen/regiones/DetalleUbicacion.kt` - Pokemon encontrables por area/metodo/version
- Nuevo tab en BottomBar o navegacion desde la region del Pokemon en su ficha

### Notas
- Las regiones son pocas (~10), cargar todas de golpe
- Las ubicaciones son muchas (~850), paginar o filtrar por region
- `location-area` es donde estan los encuentros reales (Pokemon + metodo + probabilidad)
- Conectar con la ficha del Pokemon: desde encuentros del Pokemon, navegar a la ubicacion

---

## FASE 5 - Maquinas, Concursos y Extras (COMPLETADA)

### Maquinas (MT/MO)
| Endpoint | Descripcion |
|----------|-------------|
| `machine/{id}` | Relaciona MT/MO con movimiento y version |

```kotlin
data class MachineResponse(
    val id: Int,
    val item: NamedApiResource,    // TM01, TM02, etc.
    val move: NamedApiResource,
    val versionGroup: NamedApiResource
)
```
- Integrar en la ficha del Pokemon: al lado de movimientos aprendidos por MT/MO, mostrar que MT es
- Integrar en el navegador de movimientos: mostrar que MT ensena cada movimiento

### Concursos
| Endpoint | Descripcion |
|----------|-------------|
| `contest-type/{id}` | 5 tipos de concurso (Cool, Beauty, Cute, Smart, Tough) |
| `contest-effect/{id}` | Efectos de movimientos en concursos |
| `super-contest-effect/{id}` | Efectos en super concursos (Gen IV) |

- Integrar en movimientos: anadir datos de concurso a cada movimiento
- Pantalla opcional de concursos si se quiere profundizar

### Otros endpoints menores
| Endpoint | Descripcion |
|----------|-------------|
| `pokemon-color/{id}` | Colores de Pokemon (ya se usa parcialmente via species.color) |
| `pokemon-shape/{id}` | Formas de Pokemon (cuadrupedo, humanoide, etc.) |
| `pokemon-habitat/{id}` | Habitats (cueva, bosque, etc.) |
| `language/{id}` | Idiomas disponibles |

---

## Arquitectura y patrones a seguir

### Patron para cada nuevo navegador
1. **Endpoint en `PokeApiService.kt`** - GET list + GET detail
2. **Modelo en `PokemonAPI.kt`** - Response + Summary (con `@Immutable`)
3. **ViewModel** - StateFlow para lista y summaries, carga por lotes con semaforo
4. **Screen** - Barra de busqueda arriba + LazyColumn + cards expandibles
5. **Navegacion** - Tab en BottomBar o sub-navegacion

### Cache strategy (3 niveles)
1. OkHttp disk cache (50MB) - datos estaticos de PokeAPI
2. In-memory (ConcurrentHashMap/StateFlow) - sesion actual
3. Room (si la lista es grande y se consulta frecuentemente)

### Concurrencia
- Semaphore(30-50) para limitar peticiones paralelas
- Chunks de 50 para emitir actualizaciones progresivas a la UI
- `Dispatchers.IO` para red, `Dispatchers.Main` para UI

### Localizacion
- Prioridad: espanol (es) > ingles (en) > nombre API formateado
- Cache de nombres localizados en `localizedNamesCache`

---

## Prioridad sugerida

1. **FASE 1** - Navegador de Movimientos -> COMPLETADA
2. **FASE 2** - Enriquecer ficha Pokemon (encuentros, naturalezas, crianza)
3. **FASE 3** - Items y Bayas (nuevo contenido visual atractivo con sprites)
4. **FASE 4** - Ubicaciones y Regiones (conecta todo el contenido)
5. **FASE 5** - Maquinas, Concursos y extras (completitud)
