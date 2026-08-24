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
        <>
          <PokemonFilters
            filters={filters}
            onSetFilter={setFilter}
            onReset={resetFilters}
            filtering={filtering || pokedexFilterActive}
            resultCount={visible.length}
            sortKey={sortKey}
            onSetSortKey={setSortKey}
            sortDirection={sortDirection}
            onToggleSortDirection={toggleSortDirection}
            headerControls={
              <>
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
                <div className={styles.headerControlsRight}>
                  <ViewModeToggle
                    modes={[
                      { value: 'grid', label: t('list.viewGrid') },
                      { value: 'table', label: t('list.viewTable') },
                    ]}
                    value={viewMode}
                    onChange={setViewMode}
                  />
                  <button type="button" className={styles.reload} onClick={reload} disabled={status === 'loading'}>
                    {status === 'loading' ? t('list.loading') : t('list.reload')}
                  </button>
                </div>
              </>
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
        </>
      )}
    </section>
  )
}
