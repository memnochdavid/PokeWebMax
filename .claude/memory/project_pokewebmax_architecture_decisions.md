---
name: project_pokewebmax_architecture_decisions
description: Decisiones de arquitectura de PokeWebMax y en qué difiere deliberadamente de la app Android de referencia
metadata:
  type: project
---

1. **Symfony como proxy + caché, no como dueño del modelo de datos.** A diferencia de
   ZenPaw (donde Symfony es la fuente de verdad de un CRUD normal), aquí el dato "real"
   vive en PokeAPI v2 (y más adelante WikiDex). Symfony reenvía/cachea, no inventa datos
   propios salvo metadatos de caché. Las entidades Doctrine que se creen son el
   equivalente a las 5 tablas Room del Android (`pokemon_summary`, `move_summary`,
   `item_summary`, `berry_summary`, `wikidex_cache`), ver
   [[project_pokewebmax_overview]].

2. **Cacheo MANUAL, no automático.** La app Android cachea de forma transparente y
   automática cada vez que el usuario navega. Aquí, David quiere una función/comando
   explícito que dispare la descarga desde PokeAPI v2 y la meta en la BD de Symfony —
   decisión explícita suya, no un descuido. **Why:** quiere control directo sobre cuándo
   se puebla la caché, probablemente para ir construyendo el dataset a su ritmo mientras
   aprende. **How to apply:** cuando se implemente esa función, que sea un comando de
   consola (`bin/console app:cache:...`) o un endpoint explícito, nunca cacheo implícito
   en cada GET.

3. **Todo dentro de Docker, nada en el host** — mismo patrón que
   `[[project_zenpaw_architecture_decisions]]` (memoria de otro proyecto, ZenPaw): ni
   Composer ni Node/npm instalados en la máquina.

4. **Sin autenticación por ahora.** No se ha pedido sistema de usuarios. Si en el futuro
   se aborda "favoritos/equipos" (pendiente incluso en el Android, ver
   `docs/reference-android/mejoras-pendientes.md` sección 1.2), ahí sí haría falta.
   No añadir security-bundle/JWT hasta que se pida explícitamente.

5. **CSS Modules en vez de Tailwind** — mismo criterio que ZenPaw, nativo en Vite.

6. **Puertos distintos a ZenPaw** para poder tener ambos proyectos corriendo a la vez sin
   colisión: backend `8001`, frontend `5174`, MariaDB `3307` (ZenPaw usa 8000/5173/3306).
   Contenedores con prefijo `pokewebmax_` en vez de `zenpaw_`.

**How to apply (general):** antes de añadir cualquier dependencia o patrón "porque el
Android lo tiene así", confirmar con David si ya toca esa fase — ver
`project_pokewebmax_progress.md`.
