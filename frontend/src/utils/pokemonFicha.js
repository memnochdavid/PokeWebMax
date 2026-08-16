// Secciones que ya se pueden componer con lo que devuelve el ensamblador de ficha del
// backend (PokemonFichaAssembler). Faltan Tipos/Ubicaciones/Sprites del diseño de
// referencia (ver captura de Dexter, 2026-08-16): necesitan cruzar con recursos que el
// ensamblador todavía no resuelve (`type`, encounters) o carecen de asset propio
// (carátulas de juego) — no se inventan aquí.
export const FICHA_SECTIONS = [
  { key: 'DESC', label: 'Descripción', missingKey: 'species' },
  { key: 'EVOS', label: 'Evolución', missingKey: 'evolutionChain' },
  { key: 'STATS', label: 'Stats', missingKey: null },
  { key: 'ABILITY', label: 'Habilidades', missingKey: 'abilities' },
  { key: 'MOVES', label: 'Movimientos', missingKey: 'moves' },
  { key: 'INFO', label: 'Info', missingKey: 'species' },
  { key: 'FORM', label: 'Formas', missingKey: 'forms' },
]

export function sectionMissingCount(missing, missingKey) {
  if (missingKey === null || !missing) return 0
  const value = missing[missingKey]
  return typeof value === 'boolean' ? (value ? 1 : 0) : value
}

export function totalMissing(missing) {
  if (!missing) return 0
  const uniqueKeys = new Set(FICHA_SECTIONS.map(({ missingKey }) => missingKey).filter(Boolean))
  return Array.from(uniqueKeys).reduce((sum, key) => sum + sectionMissingCount(missing, key), 0)
}

export function spanishGenus(species) {
  return species?.genera?.find((g) => g.language.name === 'es')?.genus ?? null
}

// Todas las descripciones en español disponibles, una por versión de juego, con el
// texto duplicado entre versiones consecutivas colapsado en una sola entrada (varias
// ediciones suelen compartir la misma redacción) — evita un selector con 20+ pastillas
// casi idénticas.
export function spanishFlavorTextsByVersion(species) {
  const entries = species?.flavor_text_entries?.filter((e) => e.language.name === 'es') ?? []
  const seen = new Map()
  for (const entry of entries) {
    const text = entry.flavor_text.replace(/[\n\f]/g, ' ')
    if (!seen.has(text)) {
      seen.set(text, entry.version.name)
    }
  }
  return Array.from(seen, ([text, version]) => ({ version, text }))
}

const ROMAN_GENERATIONS = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 }

export function generationNumber(species) {
  const roman = species?.generation?.name?.split('-')[1]
  return roman ? (ROMAN_GENERATIONS[roman] ?? null) : null
}

function idFromUrl(url) {
  const segments = url.split('/').filter(Boolean)
  return Number(segments[segments.length - 1])
}

function evolutionMethodLabel(details) {
  const d = details?.[0]
  if (!d) return null
  if (d.min_level) return `Nivel ${d.min_level}`
  if (d.item) return `Usar ${d.item.name.replace(/-/g, ' ')}`
  if (d.min_happiness) return `Felicidad ${d.min_happiness}+`
  if (d.trigger?.name === 'trade') return 'Intercambio'
  return 'Evoluciona'
}

// Aplana la cadena evolutiva (estructura recursiva chain.evolves_to[]) a una lista
// ordenada de etapas con el método de la transición ANTERIOR a cada una — ignora ramas
// alternativas (ej. Eevee), suficiente para una vista lineal simple.
export function evolutionStages(evolutionChain) {
  const stages = []
  let node = evolutionChain?.chain
  let method = null
  while (node) {
    stages.push({ id: idFromUrl(node.species.url), name: node.species.name, method })
    method = evolutionMethodLabel(node.evolves_to?.[0]?.evolution_details)
    node = node.evolves_to?.[0]
  }
  return stages
}
