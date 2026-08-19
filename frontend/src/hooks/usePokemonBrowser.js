import { useEffect, useMemo, useState } from 'react'
import { compareValues } from '../utils/sorting.js'
import { getStoredBrowserState, setStoredBrowserState } from '../utils/pokemonBrowserState.js'

// Catálogo interno indexado por clave (mismo criterio que TOGGLES en PokemonFilters) —
// `value(entry, names, language)` es lo que se compara.
export const SORTS = {
  number: { labelKey: 'filters.sortNumber', value: (entry) => entry.displayNumber ?? entry.id },
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

// Al filtrar por Mega/Gigamax/Regional, mostrar la VARIANTE real (su propio id,
// nombre y tipos — ej. 'raichu-alola', eléctrico/psíquico) en vez de la especie base
// que simplemente "tiene" esa variante — pedido explícito de David, antes filtrar por
// Mega mostraba a Raichu normal, no a Raichu Mega X/Y. Si una especie tiene varias
// variantes que encajan (ej. Raichu con mega X y mega Y a la vez) se muestran todas.
const VARIANT_FILTER_KINDS = { mega: 'mega', gmax: 'gmax', regional: 'regional' }

function expandToVariants(entry, filters) {
  const activeKinds = Object.entries(VARIANT_FILTER_KINDS)
    .filter(([filterKey]) => filters[filterKey])
    .map(([, kind]) => kind)
  if (activeKinds.length === 0) return [entry]

  const matches = (entry.variants ?? []).filter((v) => activeKinds.includes(v.kind))
  if (matches.length === 0) return [entry]

  return matches.map((variant) => ({ ...entry, ...variant, baseId: entry.id, baseName: entry.name }))
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

const EMPTY_CATALOG = { pokedexes: [], versions: [] }

// Ámbito Nacional/Regional (por región o por juego, ver PokedexScopeSelector y
// .claude/memory/project_pokewebmax_progress.md) — resuelve a la lista de nombres de
// Pokédex (`entry.pokedexNumbers` keys) que hay que exigir en cada Pokémon. En modo
// juego puede ser más de una a la vez (ej. Espada/Escudo → galar + isle-of-armor +
// crown-tundra), por eso siempre es un array, no un único nombre.
function resolvePokedexNames(mode, pokedexName, versionName, catalog) {
  if (mode === 'region') {
    return pokedexName ? [pokedexName] : []
  }
  const version = catalog.versions.find((v) => v.name === versionName)
  return version?.pokedexNames ?? []
}

// Navegación por generación (lazy: solo se renderiza una generación a la vez) que
// cambia a una lista plana con todos los resultados en cuanto hay algún filtro o
// búsqueda activa — mismo patrón que el paginador de generaciones del Android de
// referencia (ver GenerationPagerScreen en Dexter). Con un ámbito Regional/Juego activo
// pasa lo mismo: se aplana (no tiene sentido paginar por generación una Pokédex que ya
// es de por sí una región/juego concreto), y los filtros de texto/tipo/etc. se aplican
// SIEMPRE por encima de ese ámbito (antes ignoraban `activeGeneration` y aplanaban todo
// el nacional; ahora, con Regional activo, filtrar por tipo dentro de "Johto Original"
// muestra solo los de Johto, no los 1025 — ver plan de la sesión).
export default function usePokemonBrowser(pokemonList, { names = {}, language = 'es', pokedexCatalog = EMPTY_CATALOG } = {}) {
  // Estado inicial recuperado de pokemonBrowserState.js si PokemonListPage ya se había
  // montado antes en esta pestaña (ej. volviendo de una ficha) — así no se resetean
  // filtros/orden/Pokédex elegida en cada ida y vuelta (pedido explícito de David).
  const stored = getStoredBrowserState()

  const [filters, setFilters] = useState(stored?.filters ?? EMPTY_FILTERS)
  const [activeGeneration, setActiveGeneration] = useState(stored?.activeGeneration ?? 1)
  const [sortKey, setSortKey] = useState(stored?.sortKey ?? 'number')
  const [sortDirection, setSortDirection] = useState(stored?.sortDirection ?? 'asc')

  const [pokedexScope, setPokedexScopeState] = useState(stored?.pokedexScope ?? 'national') // 'national' | 'regional'
  const [pokedexMode, setPokedexModeState] = useState(stored?.pokedexMode ?? 'region') // 'region' | 'game'
  const [pokedexRegion, setPokedexRegionState] = useState(stored?.pokedexRegion ?? '')
  const [pokedexName, setPokedexName] = useState(stored?.pokedexName ?? '')
  const [versionName, setVersionNameState] = useState(stored?.versionName ?? '')
  // "Solo exclusivos de este juego" (necesita encuentros cacheados por especie, ver
  // PokemonListPage — botón contextual) — solo tiene sentido en modo Juego con una
  // versión elegida que tenga "hermanas" en su grupo (ej. Espada/Escudo). Se resetea
  // cada vez que cambia el juego elegido, no solo el modo/ámbito.
  const [exclusiveOnly, setExclusiveOnlyState] = useState(stored?.exclusiveOnly ?? false)

  useEffect(() => {
    setStoredBrowserState({
      filters,
      activeGeneration,
      sortKey,
      sortDirection,
      pokedexScope,
      pokedexMode,
      pokedexRegion,
      pokedexName,
      versionName,
      exclusiveOnly,
    })
  }, [
    filters,
    activeGeneration,
    sortKey,
    sortDirection,
    pokedexScope,
    pokedexMode,
    pokedexRegion,
    pokedexName,
    versionName,
    exclusiveOnly,
  ])

  const setPokedexScope = (scope) => {
    setPokedexScopeState(scope)
    setPokedexModeState('region')
    setPokedexRegionState('')
    setPokedexName('')
    setVersionNameState('')
    setExclusiveOnlyState(false)
  }
  const setPokedexMode = (mode) => {
    setPokedexModeState(mode)
    setPokedexRegionState('')
    setPokedexName('')
    setVersionNameState('')
    setExclusiveOnlyState(false)
  }
  const setPokedexRegion = (region) => {
    setPokedexRegionState(region)
    setPokedexName('')
  }
  const setVersionName = (version) => {
    setVersionNameState(version)
    setExclusiveOnlyState(false)
  }
  const setExclusiveOnly = (value) => setExclusiveOnlyState(value)

  const pokedexOptionsForRegion = useMemo(
    () => pokedexCatalog.pokedexes.filter((p) => p.region === pokedexRegion),
    [pokedexCatalog, pokedexRegion],
  )
  // Si la región solo tiene una Pokédex, se usa directamente sin obligar a elegirla en
  // un 4º select (ver PokedexScopeSelector) — puramente derivado, no hay estado que
  // sincronizar a mano.
  const activePokedexName =
    pokedexName || (pokedexOptionsForRegion.length === 1 ? pokedexOptionsForRegion[0].name : '')

  const resolvedPokedexNames = useMemo(
    () =>
      pokedexScope === 'regional'
        ? resolvePokedexNames(pokedexMode, activePokedexName, versionName, pokedexCatalog)
        : [],
    [pokedexScope, pokedexMode, activePokedexName, versionName, pokedexCatalog],
  )
  const pokedexFilterActive = resolvedPokedexNames.length > 0

  // Pokémon de la Pokédex del juego/región activa, ANTES de "solo exclusivos" y de los
  // filtros de texto/tipo — lo necesita el banner de la lista para saber a qué ids
  // pedir encuentros cacheados (tiene que ser la lista completa del juego, no la ya
  // reducida por exclusiveOnly, que sin datos cacheados empezaría vacía).
  const pokedexScopedEntries = useMemo(
    () =>
      pokedexFilterActive
        ? pokemonList.filter((entry) => resolvedPokedexNames.some((name) => entry.pokedexNumbers?.[name] != null))
        : [],
    [pokemonList, pokedexFilterActive, resolvedPokedexNames],
  )

  // "Hermanas" de la versión elegida dentro de su mismo grupo (ej. versionName='sword'
  // → siblingVersions=['shield']) — un Pokémon es exclusivo de `versionName` si tiene
  // encuentros ahí y en NINGUNA de estas.
  const { siblingVersions, hasSiblingVersions } = useMemo(() => {
    const version = pokedexCatalog.versions.find((v) => v.name === versionName)
    const siblings = (version?.groupVersions ?? []).filter((v) => v !== versionName)
    return { siblingVersions: siblings, hasSiblingVersions: siblings.length > 0 }
  }, [pokedexCatalog, versionName])

  const generations = useMemo(() => {
    const counts = new Map()
    for (const entry of pokemonList) {
      if (entry.generation == null) continue
      counts.set(entry.generation, (counts.get(entry.generation) ?? 0) + 1)
    }
    return Array.from(counts, ([id, count]) => ({ id, count })).sort((a, b) => a.id - b.id)
  }, [pokemonList])

  const filtering = hasActiveFilters(filters)

  const displayNumberFor = (entry) => {
    if (!pokedexFilterActive) return entry.id
    // Un juego puede repartirse en varias Pokédex a la vez (ej. Espada/Escudo): no hay
    // un número regional único y válido para las tres, así que se mantiene el nacional
    // en vez de inventar uno — ver plan de la sesión.
    if (resolvedPokedexNames.length !== 1) return entry.id
    return entry.pokedexNumbers?.[resolvedPokedexNames[0]] ?? entry.id
  }

  const visible = useMemo(() => {
    const base = pokedexFilterActive
      ? pokedexScopedEntries
      : filtering
        ? pokemonList
        : pokemonList.filter((entry) => entry.generation === activeGeneration)
    const exclusiveFiltered =
      pokedexMode === 'game' && exclusiveOnly && versionName && hasSiblingVersions
        ? base.filter(
            (entry) =>
              entry.encounterVersions?.includes(versionName) &&
              !siblingVersions.some((sibling) => entry.encounterVersions?.includes(sibling)),
          )
        : base
    const matched = filtering
      ? exclusiveFiltered.filter((entry) => matchesFilters(entry, filters, names[entry.id]?.names[language]))
      : exclusiveFiltered
    const withNumbers = matched.map((entry) => ({ ...entry, displayNumber: displayNumberFor(entry) }))
    const expanded = filtering ? withNumbers.flatMap((entry) => expandToVariants(entry, filters)) : withNumbers
    return [...expanded].sort(compareBy(sortKey, sortDirection, names, language))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pokemonList,
    pokedexScopedEntries,
    filters,
    filtering,
    activeGeneration,
    pokedexFilterActive,
    pokedexMode,
    exclusiveOnly,
    versionName,
    hasSiblingVersions,
    siblingVersions,
    names,
    language,
    sortKey,
    sortDirection,
  ])

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
    pokedexScope,
    setPokedexScope,
    pokedexMode,
    setPokedexMode,
    pokedexRegion,
    setPokedexRegion,
    pokedexName: activePokedexName,
    setPokedexName,
    pokedexOptionsForRegion,
    versionName,
    setVersionName,
    pokedexFilterActive,
    pokedexScopedEntries,
    exclusiveOnly,
    setExclusiveOnly,
    hasSiblingVersions,
  }
}
