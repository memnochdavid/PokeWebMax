---
name: feedback_verify_low_coverage_numbers
description: Antes de reportar como definitivo un número de cobertura/cruce sorprendentemente bajo, revisar el propio método de medición — puede ser un bug de matching, no un hueco real de datos
metadata:
  type: project
---

Cuando un cruce por nombre/título entre dos fuentes de datos da una cobertura mucho más
baja de lo esperado, sospechar primero del método de cruce antes de aceptar el número
y proponer decisiones basadas en él.

**Por qué:** al extender el fallback de WikiDex a habilidades/movimientos (ver
[[project_pokewebmax_progress]], sección "paridad total"), un primer cruce por nombre
exacto dio 68%/70% de cobertura — muy por debajo del ~100% que sí funcionaba para
especies. Se reportó ese número y se ofrecieron opciones para decidir cómo seguir.
David preguntó "¿seguro que no se ha incluido... en el scraping? puede que no te haya
entendido" — no aceptó el número sin más. Investigando de nuevo apareció el bug real:
WikiDex titula las páginas como "Hispanoamérica/España" cuando el nombre regional
difiere (`Tacleada/Placaje` para Tackle), un patrón que el primer cruce no probaba. Con
eso corregido la cobertura real era 97%/78%, radicalmente distinta.

**Cómo aplicar:** cuando un número de cobertura/matching salga sorprendentemente bajo
(sobre todo si una fuente similar YA dio ~100% con el mismo método, como species vs.
abilities/moves aquí), antes de reportarlo como hallazgo final: (a) mirar ejemplos
concretos de "no encontrados" a mano, no solo el agregado, (b) comprobar si la fuente
tiene alguna convención de formato distinta para ese tipo de contenido (aquí: títulos
compuestos por región) que el método de cruce no contempla, (c) si el usuario pregunta
"¿seguro?", tratarlo como señal real de que vale la pena remedir, no como que hay que
justificar el número ya dado.
