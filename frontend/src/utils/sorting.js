// Comparador genérico ascendente/descendente con "sin dato siempre al final" (no como
// si fuera 0/'', que engañaría en cualquier campo numérico o de texto: "el más ligero"
// no debería ser "el que no sabemos su peso"). Compartido entre el orden de la lista
// de Pokémon (usePokemonBrowser) y el de la tabla de movimientos de la ficha.
export function compareValues(a, b, direction = 'asc') {
  const dir = direction === 'desc' ? -1 : 1
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'string') return dir * a.localeCompare(b)
  return dir * (a - b)
}
