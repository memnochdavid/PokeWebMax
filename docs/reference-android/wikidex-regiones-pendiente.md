# Fallback WikiDex para vista de Regiones (PENDIENTE)

## Problema

La vista de Regiones (Region → Location → Area → Pokemon) muestra datos en ingles porque:

1. **Nombres de ubicaciones**: PokeAPI no tiene traducciones al español para `location` ni `location-area`. Solo tiene frances, aleman e ingles.
2. **Nombres de Pokemon**: `fetchLocationAreas()` usa `formatApiName(enc.pokemon.name)` en vez de localizar el nombre via species.
3. **Nombres de areas**: Mismo problema que ubicaciones, sin traduccion española en la API.

## Diferencia con la ficha de Pokemon

WikiDex organiza datos **por Pokemon** (cada Pokemon tiene su pagina con descripciones y localizaciones por juego). La vista de regiones necesita datos organizados **por ubicacion** (que Pokemon hay en cada ruta/ciudad). WikiDex no tiene una tabla unica scrappeable para esto.

## Plan de implementacion

### Fix 1: Nombres de Pokemon en español (rapido)

En `PokemonViewModel.fetchLocationAreas()` (linea ~956), cambiar:
```kotlin
pokemonName = formatApiName(enc.pokemon.name)
```
Por una llamada a `fetchLocalizedName` usando la URL de species del Pokemon, o usar el cache de nombres localizados existente (`localizedNamesCache`). El nombre API del Pokemon (ej: "pikachu") se puede usar para construir la URL de species.

### Fix 2: Mapeo estatico de ubicaciones API → español

Crear un mapeo `Map<String, String>` con los ~800 nombres de ubicaciones de PokeAPI a español. Opciones para generarlo:

**Opcion A** - Scraping offline de WikiDex:
- WikiDex tiene paginas individuales por ubicacion (ej: `wikidex.net/wiki/Ciudad_Celeste`)
- Scrapear la lista de ubicaciones por region desde las paginas de regiones de WikiDex
- Generar un JSON/Kotlin map con los resultados
- Empaquetarlo como recurso estatico en la app

**Opcion B** - Scraping en tiempo real via WikiDexRepository:
- Crear un `RegionLocationParser` que extraiga nombres de ubicaciones de las paginas de regiones de WikiDex
- Cachear en Room con `dataType = "location_name"`
- Mas dinamico pero mas complejo y mas peticiones HTTP

**Opcion A es preferible** porque:
- Las ubicaciones son un set finito y no cambian
- Evita peticiones HTTP adicionales en tiempo real
- Se puede incluir como un archivo JSON en `assets/` o un `object` Kotlin

### Fix 3: Nombres de areas en español

Similar al fix 2. Las areas son subdivisiones de las ubicaciones. Se puede incluir en el mismo mapeo estatico o derivarlas del nombre de la ubicacion padre.

### Estructura del mapeo

```kotlin
// En api/wikidex/ o util/
object LocationNameMapper {
    // API name → nombre español
    private val locations = mapOf(
        "celadon-city" to "Ciudad Azulona",
        "viridian-forest" to "Bosque Verde",
        "kanto-route-1" to "Ruta 1",
        // ... ~800 entradas
    )

    private val areas = mapOf(
        "celadon-city-area" to "Ciudad Azulona",
        "viridian-forest-area" to "Bosque Verde",
        // ...
    )

    fun getLocalizedLocationName(apiName: String): String =
        locations[apiName] ?: formatApiName(apiName)

    fun getLocalizedAreaName(apiName: String): String =
        areas[apiName] ?: locations[apiName.substringBeforeLast("-area")]
            ?: formatApiName(apiName)
}
```

### Integracion en el ViewModel

Modificar `fetchLocationsForRegion()` y `fetchLocationAreas()` para usar el mapeo:
```kotlin
// En fetchLocationsForRegion:
val localName = d.names.find { it.language.name == "es" }?.name
    ?: LocationNameMapper.getLocalizedLocationName(d.name)

// En fetchLocationAreas:
val localName = a.names.find { it.language.name == "es" }?.name
    ?: LocationNameMapper.getLocalizedAreaName(a.name)
```

## Generacion del mapeo

Script/tarea para generar el mapeo:
1. Obtener lista completa de locations de PokeAPI: `GET /location?limit=1000`
2. Para cada location, intentar encontrar la pagina WikiDex correspondiente
3. El nombre WikiDex de la pagina es el nombre en español
4. Generar el `Map<String, String>`

Alternativa mas simple: las paginas de regiones de WikiDex (Kanto, Johto, etc.) listan las ciudades y rutas con sus nombres en español. Se pueden scrapear las ~10 paginas de regiones para obtener el grueso del mapeo.

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `api/viewModel/PokemonViewModel.kt` | Usar mapeo en fetchLocationsForRegion/fetchLocationAreas, localizar nombres de Pokemon |
| Nuevo: `util/LocationNameMapper.kt` o `assets/location_names.json` | Mapeo estatico API → español |
| Opcionalmente: `api/wikidex/WikiDexParser.kt` | Nuevo parser si se opta por scraping en tiempo real |
