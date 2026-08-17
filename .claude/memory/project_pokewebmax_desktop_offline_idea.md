---
name: project-pokewebmax-desktop-offline-idea
description: Idea explorada para llevar PokeWebMax a app de escritorio offline (Tauri + SQLite) — no decidida ni empezada
metadata:
  type: project
---

David preguntó (2026-08-17) si es factible llevar PokeWebMax a una app de escritorio
offline. Es solo una idea explorada verbalmente, **no una decisión tomada ni un
trabajo iniciado** — se guarda para retomarla si la saca en una sesión futura.

Recomendación dada, con dos rutas posibles:

1. **Preferida**: [Tauri](https://tauri.app/) envolviendo el build de Vite del
   frontend actual, cambiando el backend de MariaDB a **SQLite** (Doctrine ya lo
   soporta como driver — cambio de configuración, no de código de dominio) y
   empaquetando Symfony/PHP como proceso sidecar dentro del binario. Como el
   backend es un proxy/caché de PokeAPI (ver
   [[project_pokewebmax_architecture_decisions]]), con la caché ya poblada la app
   funciona 100% sin red.
   - Tradeoff: hay que bundlear un binario PHP portable dentro del `.app`/`.exe`
     (más peso, más complejidad de empaquetado), pero se conserva todo el código
     Symfony existente tal cual.

2. **Alternativa**: reescribir la capa de proxy/caché en algo desktop-nativo (Rust o
   Node embebido en Tauri) — binario final más ligero, pero se tira el trabajo ya
   hecho en Symfony/PHP.

**Por qué:** David quiere valorar esta opción más adelante, probablemente cuando el
grueso de las vistas web esté más maduro — no es una prioridad inmediata.

**Cómo aplicarlo:** si David retoma el tema, empezar preguntando cuál de las dos
rutas prefiere (o si ha cambiado de idea) antes de tocar nada; no asumir que ya se
decidió Tauri solo porque fue la opción recomendada aquí.
