// Las 6 secciones que ya se pueden componer con lo que devuelve el ensamblador de
// ficha del backend (PokemonFichaAssembler). INTER (tabla de tipos) queda pendiente:
// necesita cruzar con el recurso `type`, que el ensamblador todavía no resuelve.
export const FICHA_SECTIONS = [
  { key: 'DESC', label: 'Descripción', missingKey: 'species' },
  { key: 'STATS', label: 'Stats', missingKey: null },
  { key: 'EVOS', label: 'Evolución', missingKey: 'evolutionChain' },
  { key: 'MOVES', label: 'Movimientos', missingKey: 'moves' },
  { key: 'ABILITY', label: 'Habilidades', missingKey: 'abilities' },
  { key: 'FORM', label: 'Formas', missingKey: 'forms' },
]

export function sectionMissingCount(missing, missingKey) {
  if (missingKey === null || !missing) return 0
  const value = missing[missingKey]
  return typeof value === 'boolean' ? (value ? 1 : 0) : value
}

export function totalMissing(missing) {
  if (!missing) return 0
  return FICHA_SECTIONS.reduce((sum, { missingKey }) => sum + sectionMissingCount(missing, missingKey), 0)
}

export function spanishFlavorText(species) {
  const entry = species?.flavor_text_entries?.find((e) => e.language.name === 'es')
  return entry?.flavor_text.replace(/[\n\f]/g, ' ') ?? null
}

export function spanishGenus(species) {
  return species?.genera?.find((g) => g.language.name === 'es')?.genus ?? null
}

// Aplana la cadena evolutiva (estructura recursiva chain.evolves_to[]) a una lista
// ordenada de nombres, ignorando ramas alternativas — suficiente para una vista lineal
// simple; una vista con ramas (ej. Eevee) es una mejora futura.
export function flattenEvolutionChain(evolutionChain) {
  const names = []
  let node = evolutionChain?.chain
  while (node) {
    names.push(node.species.name)
    node = node.evolves_to?.[0]
  }
  return names
}
