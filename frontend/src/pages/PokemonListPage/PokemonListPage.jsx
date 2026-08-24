import { useTranslation } from 'react-i18next'
import usePokemonList from '../../hooks/usePokemonList.js'
import usePokemonBrowser from '../../hooks/usePokemonBrowser.js'
import usePokemonNames from '../../hooks/usePokemonNames.js'
import usePokedexCatalog from '../../hooks/usePokedexCatalog.js'
import useViewMode from '../../hooks/useViewMode.js'
import useCacheEncountersForIds from '../../hooks/useCacheEncountersForIds.js'
import { useLanguage } from '../../contexts/LanguageContext.jsx'
import PokemonCard from '../../components/PokemonCard/PokemonCard.jsx'
import PokemonTable from '../../components/PokemonTable/PokemonTable.jsx'
import PokemonFilters from '../../components/PokemonFilters/PokemonFilters.jsx'
import GenerationPager from '../../components/GenerationPager/GenerationPager.jsx'
import PokedexScopeSelector from '../../components/PokedexScopeSelector/PokedexScopeSelector.jsx'
import ViewModeToggle from '../../components/ViewModeToggle/ViewModeToggle.jsx'
import { capitalize } from '../../utils/pokemonFormat.js'
import { regionLabel } from '../../utils/pokedexRegions.js'
import { officialArtworkUrl } from '../../utils/spritesHome.js'
import styles from './PokemonListPage.module.css'

const VIEW_MODES = ['grid', 'table']

// Icon-only — pedido explícito de David 2026-08-24: tarjetas/tabla y recargar pasan de
// texto a icono, para caber en la cabecera fija de PokemonFilters (`headerActions`)
// junto a "Limpiar", en vez de una fila de texto aparte. Mismo estilo trazado (stroke,
// sin relleno) que el placeholder de ItemCard.jsx, no hay un set de iconos compartido
// en el proyecto.
const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
  </svg>
)

const TableIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
    <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
    <line x1="9.5" y1="9.5" x2="9.5" y2="19.5" />
    <line x1="15" y1="9.5" x2="15" y2="19.5" />
  </svg>
)

const ReloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

export default function PokemonListPage() {
  const { status, pokemon, error, reload } = usePokemonList()
  const { language } = useLanguage()
  const { t } = useTranslation()
  const names = usePokemonNames()
  const pokedexCatalog = usePokedexCatalog()
  const {
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
    pokedexRegion,
    setPokedexRegion,
    pokedexName,
    setPokedexName,
    pokedexOptionsForRegion,
    versionName,
    setVersionName,
    pokedexFilterActive,
    pokedexScopedEntries,
    exclusiveOnly,
    setExclusiveOnly,
    hasSiblingVersions,
  } = usePokemonBrowser(pokemon, { names, language, pokedexCatalog })
  const [viewMode, setViewMode] = useViewMode(VIEW_MODES, 'grid', 'pokewebmax:pokemonListViewMode')
  const encountersCache = useCacheEncountersForIds()

  const pendingEncounterIds = exclusiveOnly
    ? pokedexScopedEntries.filter((entry) => !entry.encountersCached).map((entry) => entry.id)
    : []

  const eyebrow = (() => {
    if (pokedexScope === 'regional') {
      const edition = pokedexCatalog.pokedexes.find((p) => p.name === pokedexName)
      if (edition) return edition.label[language] ?? edition.label.es ?? edition.name
      if (pokedexRegion) return regionLabel(pokedexRegion, language)
      return t('list.scopeRegional')
    }
    if (pokedexScope === 'game') {
      const version = pokedexCatalog.versions.find((v) => v.name === versionName)
      if (version) return version.label[language] ?? version.label.es ?? version.name
      return t('list.scopeGame')
    }
    return t('list.eyebrow')
  })()

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1 className={styles.title}>{t('list.title')}</h1>
        </div>
      </div>

      {status === 'error' && <p className={styles.error}>{error}</p>}

      {status === 'success' && pokemon.length === 0 && (
        <p className={styles.empty}>{t('list.empty')}</p>
      )}

      {pokemon.length > 0 && (
        // Panel de filtros + resultados como 2 columnas (antes apiladas a todo el
        // ancho) — pedido explícito de David 2026-08-24, para aprovechar mejor el
        // espacio: el panel de filtros no necesita todo el ancho de la página, y
        // dejarlo a la izquierda deja sitio a que la cuadrícula de resultados use el
        // resto en vez de quedar debajo de todo. Ver `.layout` en el CSS para la
        // cadena de flexbox/grid que le da a `.resultsColumn` un alto real sin
        // adivinar ningún número (mismo patrón ya probado en PokemonFichaPage).
        <div className={styles.layout}>
          <PokemonFilters
            filters={filters}
            onSetFilter={setFilter}
            resultCount={visible.length}
            sortKey={sortKey}
            onSetSortKey={setSortKey}
            sortDirection={sortDirection}
            onToggleSortDirection={toggleSortDirection}
            headerActions={
              <>
                {(filtering || pokedexFilterActive) && (
                  <button type="button" className={styles.clear} onClick={resetFilters}>
                    {t('filters.clear')}
                  </button>
                )}
                <ViewModeToggle
                  modes={[
                    { value: 'grid', label: t('list.viewGrid'), icon: <GridIcon /> },
                    { value: 'table', label: t('list.viewTable'), icon: <TableIcon /> },
                  ]}
                  value={viewMode}
                  onChange={setViewMode}
                />
                <button
                  type="button"
                  className={styles.reload}
                  onClick={reload}
                  disabled={status === 'loading'}
                  title={status === 'loading' ? t('list.loading') : t('list.reload')}
                  aria-label={status === 'loading' ? t('list.loading') : t('list.reload')}
                >
                  <ReloadIcon />
                </button>
              </>
            }
            pokedexSelector={
              <PokedexScopeSelector
                pokedexScope={pokedexScope}
                onSetScope={setPokedexScope}
                pokedexRegion={pokedexRegion}
                onSetRegion={setPokedexRegion}
                pokedexName={pokedexName}
                onSetPokedexName={setPokedexName}
                pokedexOptionsForRegion={pokedexOptionsForRegion}
                versionName={versionName}
                onSetVersionName={setVersionName}
                hasSiblingVersions={hasSiblingVersions}
                exclusiveOnly={exclusiveOnly}
                onSetExclusiveOnly={setExclusiveOnly}
                catalog={pokedexCatalog}
                language={language}
              />
            }
            generationPager={
              // Pedido explícito de David 2026-08-24: pasa de vivir suelto entre el
              // panel de filtros y los resultados a formar parte del propio panel
              // (ver PokemonFilters.jsx/.module.css) — la página sigue siendo quien
              // decide CUÁNDO mostrarlo (solo sin filtro de búsqueda ni de Pokédex
              // activo), el componente solo reserva el hueco si le llega algo.
              !filtering && !pokedexFilterActive ? (
                <GenerationPager
                  generations={generations}
                  activeGeneration={activeGeneration}
                  onSelect={setActiveGeneration}
                />
              ) : null
            }
          />

          <div className={styles.resultsColumn}>
            {exclusiveOnly && pendingEncounterIds.length > 0 && encountersCache.status !== 'running' && (
              <p className={styles.encountersBanner}>
                {t('list.exclusiveDataMissing', { count: pendingEncounterIds.length })}{' '}
                <button
                  type="button"
                  className={styles.encountersButton}
                  onClick={() =>
                    encountersCache.start(pendingEncounterIds, {
                      onDone: reload,
                    })
                  }
                >
                  {t('list.cacheEncountersButton', { count: pendingEncounterIds.length })}
                </button>
              </p>
            )}

            {encountersCache.status === 'running' && (
              <p className={styles.encountersBanner}>
                {t('list.cachingEncountersButton', { done: encountersCache.done, total: encountersCache.total })}
              </p>
            )}

            <div className={styles.results}>
              {visible.length === 0 ? (
                <p className={styles.empty}>{t('list.emptyFiltered')}</p>
              ) : viewMode === 'table' ? (
                <PokemonTable
                  entries={visible}
                  names={names}
                  language={language}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSetSortKey={setSortKey}
                  onToggleSortDirection={toggleSortDirection}
                />
              ) : (
                <ul className={styles.grid}>
                  {visible.map((entry) => (
                    <li key={entry.id}>
                      <PokemonCard
                        id={entry.id}
                        name={entry.name}
                        displayName={names[entry.id]?.names[language] ?? capitalize(entry.name.replace(/-/g, ' '))}
                        sprite={officialArtworkUrl(entry.id)}
                        types={entry.types}
                        number={entry.displayNumber}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
