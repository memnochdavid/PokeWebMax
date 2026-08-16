---
name: feedback_no_silent_data_collapsing
description: David prefiere ver datos reales completos y explícitos aunque haya duplicados, en vez de que la interfaz los colapse/oculte por compacidad
metadata:
  type: feedback
---

No colapsar ni agrupar entradas de datos reales (versiones de juego, entradas de una
lista, etc.) solo porque su contenido coincide con otra — aunque parezca redundante en
la UI, cada entrada real debe ser visible y seleccionable por su cuenta.

**Por qué:** en el selector de descripción de la ficha (ver
[[project_pokewebmax_progress]], sección "Versiones desaparecidas"), "Azul" se perdía
del selector porque su descripción coincidía con la de "Rojo" y el código colapsaba a
una sola pastilla. David lo detectó y preguntó si era un fallo de diseño. Cuando se le
ofreció una solución intermedia (agrupar en una pastilla "Rojo +1" con tooltip),
la rechazó explícitamente: "no importa que haya descripciones idénticas (si realmente
en los juegos eran idénticas)" — para él la fidelidad a los datos reales pesa más que
la compacidad visual.

**Cómo aplicar:** ante la tentación de "limpiar" una lista deduplicando por contenido
(no por identidad/id), preguntarse si eso oculta una entrada real y distinta del
dominio (una versión de juego, un recurso, una entidad). Si es así, no colapsar por
defecto — dejar cada entrada real visible, aunque haya repetición visual. Esto no
aplica a colapsar ruido/errores de parseo (eso sigue siendo correcto limpiarlo), solo
a datos legítimos que resultan coincidir.
