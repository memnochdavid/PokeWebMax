---
name: project_pokewebmax_overview
description: Qué es PokeWebMax, de dónde sale la inspiración y contexto del proyecto Android de referencia
metadata:
  type: project
---

Enciclopedia Pokémon web de David, réplica en Symfony+React de su propia app Android
"Dexter" (`Pokedex_API`, en `/home/david/Escritorio/WORKSPACE/Pokedex_API/`). Ese repo
Android es **de solo lectura para este proyecto**: nunca se edita ni se toca desde aquí,
solo se usa como referencia de arquitectura/features. Sus docs de roadmap están copiados
(no enlazados) en `docs/reference-android/` de este repo, para poder consultarlos sin
volver a explorar el repo Android en cada sesión — están congelados en el momento en que
se copiaron (2026-08-15), no se actualizan solos si el Android cambia.

## Alcance real de la app Android de referencia (para calibrar expectativas)

~17.100 líneas de Kotlin, 30+ endpoints de PokeAPI v2 consumidos, arquitectura MVVM con
Room como caché local. Funcionalidad: ficha de Pokémon completa (stats, cadena evolutiva,
mega/gigamax, formas regionales, movimientos, habilidades, ubicaciones/encuentros, matriz
de tipos, fondos animados por tipo — 18 overlays), navegadores independientes de
Movimientos/Items/Bayas/Regiones, scraping propio de WikiDex (datos que PokeAPI no tiene),
identificación de Pokémon por foto vía Gemini AI. Ver
`docs/reference-android/fases-pokeapi-v2.md` (fases de desarrollo ya completadas ahí) y
`docs/reference-android/mejoras-pendientes.md` (cosas que ni siquiera el Android tiene
todavía: favoritos/equipos, comparador, tests, paginación).

**Why:** es el proyecto personal de David, en paralelo a `[[project_estudio_recuperacion_nivel]]`
(memoria global) — no tiene fecha límite de entrega como ZenPaw, es iterativo.

**How to apply:** NO asumir que hay que replicar todo esto de golpe. David decidió
explícitamente ir "poco a poco" — ver
[[project_pokewebmax_architecture_decisions]] y `project_pokewebmax_progress.md` para
saber qué fase toca. Al proponer siguientes pasos, proponer el siguiente incremento
pequeño, no un plan maestro completo.
