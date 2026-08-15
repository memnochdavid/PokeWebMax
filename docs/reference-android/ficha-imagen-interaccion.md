# Ficha Pokemon - Rediseno completo

**Fecha:** 2026-03-28
**Archivos principales:** `FichaPokemon.kt`, `FichaDesplegables.kt`, `NombreNum.kt`, `StatsBase.kt`, `Encuentros.kt`, `MainActivity.kt`

---

## Cambios implementados

### 1. Interaccion imagen estatica [HECHO]
- Boton shiny `"✦"` independiente, apilado verticalmente sobre pokeball
- Botones con `zIndex(2f)` sobre la imagen
- Pulsar imagen expande/contrae con pesos animados fluidos (450ms)
- Padding de imagen se anima de 30dp a 4dp al expandir

### 2. Seccion Descripcion: dos columnas con caratulas [HECHO]
- Columna izquierda (35%): LazyColumn con caratulas de juego
- Columna derecha (65%): descripcion con citas tipograficas
- `getGameCoverResId()` soporta nombres API (ingles) y traducidos (espanol)
- Sufijos "japan" eliminados automaticamente

### 3. Seccion Ubicaciones: selector con caratulas [HECHO]
- Mismo layout dos columnas que Descripcion
- Reutiliza `translateGameVersion()` y `getGameCoverResId()` (ahora `internal`)

### 4. FAB eliminado, barra de secciones integrada [HECHO]
- FAB ya no aparece en la ficha (solo en listas)
- `LazyRow` horizontal con iconos + etiquetas dentro de `DetallesDesplegables`
- Fondo `colorDark` del tipo, bordes redondeados 12dp
- Seccion activa resaltada con fondo blanco semi-transparente

### 5. NombreNumAlturaPeso rediseñado [HECHO]
- Nombre 24sp Bold + numero 16sp SemiBold con opacidad
- Genus con letter-spacing
- Chips compactos para altura/peso
- Esquinas redondeadas inferiores (16dp)

### 6. Stats: radar hexagonal + barras interactivas [HECHO]
- Grafico radar con Canvas: anillos, gradiente radial, puntos coloreados
- Barras compactas debajo
- Tocar una vista la expande (75%) y encoge la otra (25%), animado 400ms
- Fuentes del radar escalan proporcionalmente al espacio

### 7. Paleta neutra con acentos de tipo [HECHO]
- Fondo general: `background_app` (beige neutro, mismo que listas)
- Cards: `Color.White.copy(alpha = 0.65f)` — elevacion sutil sin saturar
- Cards internas: `Color.White.copy(alpha = 0.40f)`
- Texto: `Color(0xFF1A1A1A)` — negro suave consistente
- Acentos de tipo solo en: barra secciones, bordes seleccion, imagen estatica, nombre
- ComponenteImagen mantiene colores de tipo (dual-band)
- Barra secciones y contenido con bordes redondeados sobre fondo neutro

---

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `FichaPokemon.kt` | Fondo neutro, expansion imagen, boton shiny |
| `FichaDesplegables.kt` | Paleta neutra, barra secciones, desc 2 columnas |
| `NombreNum.kt` | Rediseno completo, chips, esquinas redondeadas |
| `StatsBase.kt` | Radar hexagonal + barras interactivas |
| `Encuentros.kt` | Selector caratulas, layout 2 columnas |
| `MainActivity.kt` | FAB oculto en ficha, bottom sheet simplificado |
| `res/drawable/game_*.ext` | Caratulas renombradas (guiones -> underscores) |
