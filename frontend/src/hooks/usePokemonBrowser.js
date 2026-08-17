import { useMemo, useState } from 'react'
import { compareValues } from '../utils/sorting.js'

// Catálogo interno indexado por clave (mismo criterio que TOGGLES en PokemonFilters) —
// `value(entry, names, language)` es lo que se compara.
export const SORTS = {
  number: { labelKey: 'filters.sortNumber', value: (entry) => entry.id },
  name: {
    labelKey: 'filters.sortName',
    value: (entry, names, language) => names[entry.id]?.names[language] ?? entry.name,
  },
  type: { labelKey: 'filters.sortType', value: (entry) => entry.types[0] ?? '' },
  height: { labelKey: 'filters.sortHeight', value: (entry) => entry.height },
  weight: { labelKey: 'filters.sortWeight', value: (entry) => entry.weight },
  captureRate: { labelKey: 'filters.sortCaptureRate', value: (entry) => entry.captureRate },
  statsTotal: { labelKey: 'filters.sortStatsTotal', value: (entry) => entry.statsTotal },
}

function compareBy(sortKey, direction, names, language) {
  const { value } = SORTS[sortKey]
  return (a, b) => compareValues(value(a, names, language), value(b, names, language), direction)
}

const EMPTY_FILTERS = {
  query: '',
  type1: '',
  type2: '',
  mega: false,
  gmax: false,
  regional: false,
  legendary: false,
  mythical: false,
  evolutionStages: null, // null | 1 | 2 | 3
}

function hasActiveFilters(filters) {
  return (
    filters.query.trim() !== '' ||
    filters.type1 !== '' ||
    filters.type2 !== '' ||
    filters.mega ||
    filters.gmax ||
    filters.regional ||
    filters.legendary ||
    filters.mythical ||
    filters.evolutionStages !== null
  )
}

function matchesFilters(entry, filters, displayName) {
  const query = filters.query.trim().toLowerCase()
  if (query !== '') {
    const matchesSlug = entry.name.toLowerCase().includes(query)
    const matchesDisplay = displayName?.toLowerCase().includes(query)
    if (!matchesSlug && !matchesDisplay) return false
  }
  if (filters.type1 !== '' && !entry.types.includes(filters.type1)) return false
  if (filters.type2 !== '' && !entry.types.includes(filters.type2)) return false
  if (filters.mega && !entry.hasMega) return false
  if (filters.gmax && !entry.hasGmax) return false
  if (filters.regional && !entry.hasRegional) return false
  if (filters.legendary && !entry.legendary) return false
  if (filters.mythical && !entry.mythical) return false
  if (filters.evolutionStages !== null && entry.evolutionStages !== filters.evolutionStages) return false
  return true
}

// Navegación por generación (lazy: solo se renderiza una generación a la vez) que
// cambia a una lista plana con todos los resultados en cuanto hay algún filtro o
// búsqueda activa — mismo patrón que el paginador de generaciones del Android de
// referencia (ver GenerationPagerScreen en Dexter).
export default function usePokemonBrowser(pokemonList, { names = {}, language = 'es' } = {}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [activeGeneration, setActiveGeneration] = useState(1)
  const [sortKey, setSortKey] = useState('number')
  const [sortDirection, setSortDirection] = useState('asc')

  const generations = useMemo(() => {
    const counts = new Map()
    for (const entry of pokemonList) {
      if (entry.generation == null) continue
      counts.set(entry.generation, (counts.get(entry.generation) ?? 0) + 1)
    }
    return Array.from(counts, ([id, count]) => ({ id, count })).sort((a, b) => a.id - b.id)
  }, [pokemonList])

  const filtering = hasActiveFilters(filters)

  const visible = useMemo(() => {
    const base = filtering
      ? pokemonList.filter((entry) => matchesFilters(entry, filters, names[entry.id]?.names[language]))
      : pokemonList.filter((entry) => entry.generation === activeGeneration)
    return [...base].sort(compareBy(sortKey, sortDirection, names, language))
  }, [pokemonList, filters, filtering, activeGeneration, names, language, sortKey, sortDirection])

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))
  const resetFilters = () => setFilters(EMPTY_FILTERS)
  const toggleSortDirection = () => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))

  return {
    filters,
    setFilter,
    resetFilters,
    filtering,
    generations,
    activeGeneration,
    setActiveGeneration,
    sortKey,
    setSortKey,
    sortDirection,
    toggleSortDirection,
    visible,
  }
}
