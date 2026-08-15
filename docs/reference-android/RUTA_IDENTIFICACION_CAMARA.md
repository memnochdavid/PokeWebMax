# Ruta: Identificacion de Pokemon con camara + Gemini

## Objetivo

Anadir una pantalla con vista de camara (CameraX) que permita enfocar una imagen de un Pokemon (carta, peluche, screenshot, sprite en pantalla, dibujo oficial) y que Gemini Flash identifique de que Pokemon se trata. Con el nombre devuelto se navega directamente a la ficha del Pokemon usando el pipeline existente de PokeAPI.

---

## Estado actual

**Dependencias ya presentes:**
- CameraX 1.3.0 (`camera-core`, `camera-camera2`, `camera-lifecycle`, `camera-view`, `camera-extensions`) — `build.gradle.kts` lineas 161-165
- Accompanist Permissions 0.33.2-alpha — `build.gradle.kts` linea 167
- ML Kit image-labeling 17.0.8 — `build.gradle.kts` linea 170 (no se usara, Gemini lo reemplaza)
- Permiso `CAMERA` — `AndroidManifest.xml` linea 6
- `local.properties` ya se carga en `build.gradle.kts` lineas 1-9 (pero no se expone ningun campo a BuildConfig)

**Dependencias que faltan:**
- SDK de Google Generative AI (`com.google.ai.client:generativeai`)

**Codigo existente de camara:** Ninguno. Las dependencias estan declaradas pero no hay pantallas, composables ni logica de camara implementada.

---

## Arquitectura de la feature

```
[CameraX Preview] --> [Boton captura] --> [Bitmap redimensionado 768px]
        |                                          |
        v                                          v
  [PreviewView en                          [GeminiRepository]
   AndroidView]                             .identifyPokemon(bitmap)
                                                   |
                                                   v
                                           [Gemini Flash API]
                                            prompt + imagen
                                                   |
                                                   v
                                           [Respuesta JSON]
                                           {"name":"charizard",
                                            "confidence":"high"}
                                                   |
                                                   v
                                           [Navegar a ficha]
                                           Routes.pokemonDetails(name)
```

**Archivos nuevos a crear:**

| Archivo | Proposito |
|---------|-----------|
| `api/gemini/GeminiClient.kt` | Singleton del modelo generativo (API key, config) |
| `api/gemini/GeminiRepository.kt` | Funcion `identifyPokemon(Bitmap): GeminiResult` |
| `ui/screen/camara/CameraIdentifyScreen.kt` | Pantalla principal: preview + boton + resultado |

**Archivos existentes a modificar:**

| Archivo | Cambio |
|---------|--------|
| `build.gradle.kts` | Anadir dependencia Gemini SDK, anadir `buildConfigField` para API key, habilitar `buildConfig = true` |
| `local.properties` | Anadir `GEMINI_API_KEY=tu_key_aqui` |
| `MainActivity.kt` | Anadir ruta `CAMERA_IDENTIFY` en `Routes`, composable en `NavHost`, boton de acceso en la barra de navegacion |
| `proguard-rules.pro` | Reglas keep para Gemini SDK (si aplica en release) |

---

## Fases de implementacion

### Fase 1 — Dependencias y API key

**Objetivo:** Que el proyecto compile con Gemini SDK y la key accesible desde codigo.

1. Anadir en `build.gradle.kts` dentro del bloque `android.buildFeatures`:
   ```kotlin
   buildConfig = true
   ```

2. Anadir en `android.defaultConfig`:
   ```kotlin
   buildConfigField("String", "GEMINI_API_KEY", "\"${localProperties["GEMINI_API_KEY"] ?: ""}\"")
   ```

3. Anadir en `dependencies`:
   ```kotlin
   implementation("com.google.ai.client:generativeai:0.7.0")
   ```

4. Anadir en `local.properties` (no sube al repo, ya esta en `.gitignore`):
   ```
   GEMINI_API_KEY=tu_key_de_aistudio
   ```

5. Verificar que compila: `./gradlew assembleDebug`

**Resultado:** `BuildConfig.GEMINI_API_KEY` disponible en runtime.

---

### Fase 2 — Cliente Gemini

**Objetivo:** Encapsular la llamada a Gemini en un repositorio reutilizable.

**Archivo:** `api/gemini/GeminiClient.kt`

```kotlin
object GeminiClient {
    val model by lazy {
        GenerativeModel(
            modelName = "gemini-2.5-flash-lite",
            apiKey = BuildConfig.GEMINI_API_KEY,
            generationConfig = generationConfig {
                temperature = 0.1f       // determinista
                maxOutputTokens = 100    // respuesta corta
            }
        )
    }
}
```

**Archivo:** `api/gemini/GeminiRepository.kt`

```kotlin
data class PokemonIdentification(
    val name: String,           // nombre en ingles, minusculas (slug PokeAPI)
    val confidence: String      // "high", "medium", "low"
)

class GeminiRepository {
    suspend fun identifyPokemon(bitmap: Bitmap): PokemonIdentification? {
        // 1. Redimensionar bitmap a 768px lado largo
        // 2. Crear content con imagen + prompt
        // 3. Parsear JSON de respuesta
        // 4. Devolver null si "unknown" o confianza baja
    }
}
```

**Prompt para Gemini:**
```
Analyze this image and identify the Pokemon shown.
Respond ONLY with a JSON object, no markdown, no extra text:
{"name": "<english name in lowercase>", "confidence": "<high|medium|low>"}
If there is no Pokemon in the image, respond: {"name": "unknown", "confidence": "low"}
For regional forms, include the prefix: "alolan-vulpix", "galarian-zigzagoon", etc.
For mega evolutions: "charizard-mega-x", "charizard-mega-y".
```

**Resultado:** `GeminiRepository().identifyPokemon(bitmap)` devuelve el nombre listo para PokéAPI.

---

### Fase 3 — Pantalla de camara

**Objetivo:** Preview de camara a pantalla completa con boton de escaneo.

**Archivo:** `ui/screen/camara/CameraIdentifyScreen.kt`

**Componentes:**

1. **Gestion de permisos** (Accompanist):
   - Si no concedido: pantalla con texto explicativo y boton "Conceder permiso"
   - Si concedido: preview de camara

2. **Preview de camara** (CameraX + AndroidView):
   - `PreviewView` ocupando toda la pantalla
   - `ImageCapture` use case configurado
   - Resolucion de captura: `CAPTURE_MODE_MINIMIZE_LATENCY`

3. **Overlay UI** (sobre el preview):
   - Boton circular de escaneo (abajo centro), estilo Pokeball
   - Boton de retroceso (arriba izquierda)
   - Indicador de estado: idle / analizando / resultado
   - Animacion de carga mientras Gemini responde (1-3s tipico)

4. **Flujo de resultado:**
   - Si `confidence == "high"`: navegar directo a `Routes.pokemonDetails(name)`
   - Si `confidence == "medium"`: mostrar overlay con nombre + sprite (desde PokeAPI) + boton "Ver ficha" / "Reintentar"
   - Si `confidence == "low"` o `unknown`: mostrar mensaje "No identificado" con boton reintentar

**Estructura del composable:**

```kotlin
@Composable
fun CameraIdentifyScreen(
    pokemonViewModel: PokemonViewModel,
    onNavigateToDetails: (String) -> Unit,
    onNavigateBack: () -> Unit
)
```

**Resultado:** Pantalla funcional que captura foto, la envia a Gemini, y navega a la ficha.

---

### Fase 4 — Integracion en navegacion

**Objetivo:** Hacer la pantalla accesible desde la app.

**Cambios en `MainActivity.kt`:**

1. Anadir ruta en `Routes`:
   ```kotlin
   const val CAMERA_IDENTIFY = "camera_identify"
   ```

2. Anadir composable en `NavHost` (despues de EXTRAS_BROWSER, antes de POKEMON_DETAILS):
   ```kotlin
   composable(Routes.CAMERA_IDENTIFY) {
       CameraIdentifyScreen(
           pokemonViewModel = pokemonViewModel,
           onNavigateToDetails = { pokemonName ->
               pokemonViewModel.resetDetailState()
               navController.navigate(Routes.pokemonDetails(pokemonName))
           },
           onNavigateBack = { navController.popBackStack() }
       )
   }
   ```

3. **Acceso desde la UI** — dos opciones (elegir una):

   **Opcion A: FAB flotante** (recomendada)
   - `FloatingActionButton` con icono de camara en la esquina inferior derecha
   - Solo visible cuando NO estamos en la ficha de detalle ni en la propia camara
   - Click navega a `Routes.CAMERA_IDENTIFY`
   - En landscape: boton en la barra lateral

   **Opcion B: Sexto item en la barra de navegacion**
   - Anadir `NavItem(Routes.CAMERA_IDENTIFY, "Camara", R.drawable.ic_camera)` a `navItems`
   - Requiere icono vectorial de camara en `drawable`

**Resultado:** Feature accesible y navegable desde cualquier pantalla principal.

---

### Fase 5 — Pulido y edge cases

**Objetivo:** Robustez y buena UX.

1. **Mapeo de nombres Gemini -> PokéAPI:**
   - Gemini puede devolver nombres ligeramente distintos al slug de PokéAPI
   - Crear mapa de correcciones conocidas (ej: `"mr. mime" -> "mr-mime"`, `"farfetch'd" -> "farfetchd"`, `"nidoran female" -> "nidoran-f"`)
   - Fallback: buscar en la lista cacheada de `PokemonSummaryEntity` por coincidencia parcial

2. **Timeout y errores de red:**
   - Timeout de 10s para la llamada a Gemini
   - Si falla: mostrar mensaje "Sin conexion" con boton reintentar
   - No bloquear la UI (coroutine en viewModelScope)

3. **Redimensionado de imagen:**
   - Antes de enviar a Gemini, redimensionar a max 768px en su lado largo
   - Comprimir como JPEG quality 85 para reducir payload
   - Reduce latencia y consumo de tokens significativamente

4. **Haptics:**
   - Haptic feedback en el boton de escaneo (como ya haces en `NavBarButtons`)
   - Haptic diferente en resultado exitoso vs no identificado

5. **Historial de escaneos (opcional futuro):**
   - Guardar en Room los ultimos N escaneos (imagen thumbnail + nombre + timestamp)
   - Pantalla de historial accesible desde ajustes o extras

---

## Dependencias finales

```kotlin
// build.gradle.kts — anadir a dependencies
implementation("com.google.ai.client:generativeai:0.7.0")
```

Las demas dependencias (CameraX, Accompanist Permissions) ya estan presentes.

---

## Estimacion de complejidad por fase

| Fase | Archivos tocados | Complejidad |
|------|-----------------|-------------|
| 1. Dependencias y key | 2 (`build.gradle.kts`, `local.properties`) | Baja |
| 2. Cliente Gemini | 2 nuevos (`GeminiClient.kt`, `GeminiRepository.kt`) | Baja |
| 3. Pantalla camara | 1 nuevo (`CameraIdentifyScreen.kt`) | Media-alta |
| 4. Navegacion | 1 modificado (`MainActivity.kt`) | Baja |
| 5. Pulido | Varios | Media |

**Fase critica:** La 3 es donde esta el grueso del trabajo. CameraX con Compose requiere `AndroidView` wrapping del `PreviewView`, gestion del ciclo de vida de la camara, y coordinacion entre el estado de captura y la UI.

---

## Notas

- La API key se obtiene gratis en [aistudio.google.com](https://aistudio.google.com) sin tarjeta de credito
- El free tier de Gemini da 500-1000 RPD, mas que suficiente para uso personal
- `gemini-2.5-flash-lite` es el modelo recomendado: rapido, ligero, y conoce la franquicia Pokemon perfectamente
- Si Google cambiara el free tier, migrar a OpenRouter o Groq son cambios de ~10 lineas en `GeminiClient.kt`
- ML Kit (`image-labeling`) se puede eliminar de las dependencias si no se usa para otra cosa — Gemini lo reemplaza completamente para esta tarea
