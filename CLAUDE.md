# PokeWebMax

Enciclopedia Pokémon web personal de David. Es la versión web, con Symfony + React, del
proyecto Android `Pokedex_API` (nombre interno "Dexter") que vive en
`/home/david/Escritorio/WORKSPACE/Pokedex_API/` — **ese proyecto es de solo lectura, nunca
se toca ni se modifica desde aquí**, solo sirve de referencia/inspiración. Copias de sus
documentos de arquitectura están en `docs/reference-android/` para no tener que
re-explorar el repo Android en cada sesión.

## Instrucción permanente para Claude

Al empezar cualquier sesión en este repo (en cualquier máquina), **lee primero
`.claude/memory/MEMORY.md`** y los archivos que enlace antes de proponer o ejecutar nada.
Esa carpeta es la memoria persistente del proyecto — viaja con el repo vía git. Mantenla
actualizada: nuevas decisiones de arquitectura, progreso, bloqueos. No la ignores. No debe
añadirse a ningún `.gitignore`.

## Resumen del proyecto (ver memoria para detalle)

- Backend: Symfony como API JSON en `backend/`, dentro de Docker. Su rol NO es dueño del
  modelo de datos como en un CRUD normal — es un **proxy + caché** de PokeAPI v2 (y, más
  adelante, de otras fuentes como WikiDex). Sin autenticación por ahora (no se ha pedido).
- Frontend: React (Vite) en `frontend/`, dentro de Docker, CSS Modules (no Tailwind, mismo
  criterio que en ZenPaw).
- Toda la toolchain (Composer, Node/npm) corre en contenedores — nada instalado en el host.
- A diferencia de la app Android (que cachea de PokeAPI de forma automática en Room), aquí
  el cacheo hacia la base de datos será **manual**, disparado explícitamente por el
  usuario — decisión explícita de David, ver
  `.claude/memory/project_pokewebmax_architecture_decisions.md`.
- Desarrollo incremental "poco a poco": no se está replicando toda la app Android de una
  vez. Ver `.claude/memory/project_pokewebmax_progress.md` para la fase actual.
