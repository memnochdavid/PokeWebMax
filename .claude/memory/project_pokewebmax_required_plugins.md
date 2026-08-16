---
name: project_pokewebmax_required_plugins
description: Plugins de Claude Code que este proyecto espera tener instalados para el trabajo de diseño de frontend
metadata:
  type: reference
---

Para el trabajo de diseño visual del frontend (CSS Modules en `frontend/src/`), este
proyecto espera tener instalados estos dos plugins del marketplace oficial
(`claude-plugins-official`, `github.com/anthropics/claude-plugins-official`):

- **`frontend-design@claude-plugins-official`** (Anthropic, oficial) — skill de proceso
  de diseño: sistema de tokens (color/tipografía/layout), wireframe antes de programar,
  y checklist para evitar el "look genérico de IA". Sin dependencias externas.
- **`superdesign@claude-plugins-official`** (comunidad, v0.4.3 a fecha de esta nota) —
  lienzo de diseño que lee el repo y genera variantes de UI. Pensado más para crear
  identidad visual desde cero que para imitar una app de referencia; puede depender de
  una herramienta/canvas externo (sin confirmar en detalle todavía).

**Why:** David pidió explícitamente (2026-08-16) que se instalaran skills de diseño
para mejorar el trabajo visual del frontend — ver
[[project_pokewebmax_progress]] para el contexto del rediseño de la ficha que motivó
la búsqueda. Instaladas en scope `user` (no en el repo), así que **cualquier máquina
nueva donde se trabaje en este proyecto necesita instalarlas a mano**:
```
claude plugin install frontend-design@claude-plugins-official
claude plugin install superdesign@claude-plugins-official
```
(si `claude-plugins-official` no está añadido como marketplace en esa máquina, antes
hace falta `claude plugin marketplace add anthropics/claude-plugins-official` o
equivalente).

**How to apply:** al empezar cualquier sesión que toque diseño visual del frontend en
este proyecto, comprobar si estas dos skills están disponibles (pueden tardar un
reinicio de sesión en aparecer tras instalarse) y usarlas en vez de improvisar criterio
de diseño sin proceso. Si en una máquina nueva no aparecen, instalarlas primero con los
comandos de arriba antes de asumir que no están disponibles.
