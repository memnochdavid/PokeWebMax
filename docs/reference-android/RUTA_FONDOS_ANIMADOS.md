# Ruta: Fondos animados por tipo

## Objetivo

Reemplazar el fondo estático de degradado en `ComponenteImagen` (ficha del Pokemon) por un fondo animado temático para cada tipo. El fondo se renderiza con Compose Canvas/animaciones, sin assets externos.

---

## Estado actual

**Archivo:** `FichaPokemon.kt` lineas 826-900 (dentro de `ComponenteImagen`)

**Como funciona:**
- Se obtienen los colores del tipo con `getPokemonTypeGradientColors(typeName)` (devuelve `Pair<Color, Color>`)
- Se oscurecen con `.darken(0.75f)`
- **Monotipo:** `Box` con `Brush.verticalGradient` de los 2 colores
- **Doble tipo:** `Column` con 2 `Box` (50/50 vertical), cada uno con su propio gradiente
- En la esquina inferior derecha de cada zona se muestra el icono del tipo al 40% de opacidad

**Donde intervenir:** Reemplazar los `Box` con gradiente por un composable `TypeAnimatedBackground(typeName)` que renderice el fondo animado. El icono del tipo se puede mantener o integrar en la animacion.

---

## Alcance por tipo

Cada tipo deberia tener una animacion que evoque su elemento. Todas las animaciones se hacen con Compose `Canvas` + `animateFloat`/`InfiniteTransition`, sin Lottie ni assets.

### Prioridad 1 — Tipos con animaciones claras

- [ ] **Fire** — Particulas ascendentes tipo brasas/llamas. Circulos naranjas/rojos que suben con movimiento sinusoidal y se desvanecen.
- [ ] **Water** — Ondas horizontales suaves. Lineas curvas sinusoidales que se desplazan lateralmente, simulando superficie de agua.
- [ ] **Electric** — Rayos/chispas. Lineas en zigzag que aparecen y desaparecen aleatoriamente, con un flash sutil de fondo.
- [ ] **Ice** — Copos/cristales cayendo. Particulas blancas/azul claro que caen lentamente con rotacion.
- [ ] **Grass** — Hojas flotando. Particulas verdes que caen diagonalmente con movimiento pendular.
- [ ] **Ghost** — Niebla/orbes flotantes. Circulos semitransparentes morados que flotan lentamente y pulsan en opacidad.

### Prioridad 2 — Tipos con animaciones mas sutiles

- [ ] **Psychic** — Ondas concentricas pulsantes. Circulos que se expanden desde el centro y se desvanecen.
- [ ] **Dragon** — Energia/aura. Particulas que ascienden rapido con trails, colores indigo/violeta.
- [ ] **Dark** — Sombras pulsantes. Manchas oscuras que se expanden y contraen lentamente, efecto opresivo.
- [ ] **Fairy** — Destellos/estrellas. Puntos brillantes que aparecen, pulsan y desaparecen aleatoriamente.
- [ ] **Poison** — Burbujas toxicas. Circulos que suben lentamente, crecen y explotan.
- [ ] **Fighting** — Ondas de impacto. Circulos concentricos que se expanden rapido desde puntos aleatorios.

### Prioridad 3 — Tipos con animaciones ambientales

- [ ] **Ground** — Particulas de polvo/arena. Puntos marrones que se mueven horizontalmente con turbulencia.
- [ ] **Rock** — Fragmentos cayendo lentos. Formas angulares que caen con gravedad y leve rotacion.
- [ ] **Steel** — Reflejos metalicos. Lineas diagonales de brillo que se desplazan lentamente (efecto brushed metal).
- [ ] **Flying** — Nubes/corrientes. Formas suaves blancas que se desplazan horizontalmente a distintas velocidades (parallax).
- [ ] **Bug** — Particulas verdes/puntos luminosos. Similar a luciernagas pulsando en un fondo verdoso.
- [ ] **Normal** — Particulas neutras sutiles. Puntos grises claros que flotan lentamente sin direccion fija, muy sutil.

---

## Implementacion tecnica

### Arquitectura

```
ui/screen/ficha/composable/background/
    TypeAnimatedBackground.kt    — Composable selector que elige el fondo segun el tipo
    FireBackground.kt            — Fondo animado de fuego
    WaterBackground.kt           — Fondo animado de agua
    ...                          — Un archivo por tipo
    ParticleSystem.kt            — Sistema de particulas reutilizable
```

### Sistema de particulas comun

La mayoria de tipos usan variaciones de un sistema de particulas. Crear un `ParticleSystem` reutilizable:

```kotlin
data class Particle(
    var x: Float,           // posicion X (0..1 normalizada)
    var y: Float,           // posicion Y (0..1 normalizada)
    var vx: Float,          // velocidad X
    var vy: Float,          // velocidad Y
    var alpha: Float,       // opacidad
    var size: Float,        // tamano
    var life: Float,        // vida restante (0..1)
    var rotation: Float     // rotacion (para hojas, copos, etc.)
)
```

Con esto, cada tipo solo define:
- Colores
- Direccion/velocidad de particulas
- Forma de particula (circulo, linea, copo, hoja...)
- Comportamiento de spawn/muerte

### Integracion en ComponenteImagen

El degradado actual se **conserva** como base. Las particulas/animaciones se renderizan **encima** del degradado, como una capa superpuesta. El fondo nunca queda vacio ni cambia de aspecto base.

```kotlin
// AHORA (linea 888):
Box(modifier = Modifier.fillMaxSize()
    .background(Brush.verticalGradient(listOf(g1.first, g1.second))))

// DESPUES:
Box(modifier = Modifier.fillMaxSize()
    .background(Brush.verticalGradient(listOf(g1.first, g1.second)))) {
    TypeAnimatedOverlay(
        typeName = type1Name ?: "normal",
        modifier = Modifier.fillMaxSize()
    )
}
```

Para doble tipo, el fondo superior usa tipo 1 y el inferior tipo 2 (igual que ahora pero animado). Cada mitad tiene su propio overlay de particulas.

### Rendimiento

- Usar `rememberInfiniteTransition` para animaciones por tiempo
- Limitar particulas a 15-25 por fondo (suficiente para el efecto, ligero en GPU)
- Usar `Canvas` con `drawCircle`/`drawLine` (no composables anidados)
- Solo animar cuando la pagina esta activa (`isActivePage`)

---

## Orden de trabajo

Cada checkbox es un paso independiente que se puede commitear:

1. [ ] Crear `ParticleSystem.kt` con el sistema de particulas comun
2. [ ] Crear `TypeAnimatedBackground.kt` (selector + fallback a gradiente estatico)
3. [ ] Integrar en `ComponenteImagen` reemplazando los `Box` con gradiente
4. [ ] **Fire** — primer tipo, sirve para validar la arquitectura
5. [ ] **Water**
6. [ ] **Electric**
7. [ ] **Ice**
8. [ ] **Grass**
9. [ ] **Ghost**
10. [ ] **Psychic**
11. [ ] **Dragon**
12. [ ] **Dark**
13. [ ] **Fairy**
14. [ ] **Poison**
15. [ ] **Fighting**
16. [ ] **Ground**
17. [ ] **Rock**
18. [ ] **Steel**
19. [ ] **Flying**
20. [ ] **Bug**
21. [ ] **Normal**
22. [ ] Revision final y ajustes de rendimiento

---

## Limitaciones de Claude Code

Puedo generar el 100% de estas animaciones con Compose Canvas. Lo que **no** puedo hacer:
- Ver el resultado visual en pantalla (no tengo acceso a emulador)
- Ajustar la estetica iterativamente sin tu feedback ("mas rapido", "menos particulas", "otro tono")

**Flujo recomendado:** Implemento un tipo, tu lo pruebas en release en el Redmi, me dices que ajustar, itero. Asi para cada tipo.
