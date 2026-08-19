import { useTranslation } from 'react-i18next'
import usePokemonList from '../../hooks/usePokemonList.js'
import usePokemonBrowser from '../../hooks/usePokemonBrowser.js'
import usePokemonNames from '../../hooks/usePokemonNames.js'
import usePokedexCatalog from '../../hooks/usePokedexCatalog.js'
import { useLanguage } from '../../contexts/LanguageContext.jsx'
import PokemonCard from '../../components/PokemonCard/PokemonCard.jsx'
import PokemonFilters from '../../components/PokemonFilters/PokemonFilters.jsx'
import GenerationPager from '../../components/GenerationPager/GenerationPager.jsx'
import PokedexScopeSelector from '../../components/PokedexScopeSelector/PokedexScopeSelector.jsx'
import { capitalize } from '../../utils/pokemonFormat.js'
import { regionLabel } from '../../utils/pokedexRegions.js'
import styles from './PokemonListPage.module.css'

const officialArtworkUrl = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

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
    pokedexMode,
    setPokedexMode,
    pokedexRegion,
    setPokedexRegion,
    pokedexName,
    setPokedexName,
    pokedexOptionsForRegion,
    versionName,
    setVersionName,
    pokedexFilterActive,
  } = usePokemonBrowser(pokemon, { names, language, pokedexCatalog })

  const eyebrow = (() => {
    if (pokedexScope !== 'regional') return t('list.eyebrow')
    if (pokedexMode === 'region') {
      const edition = pokedexCatalog.pokedexes.find((p) => p.name === pokedexName)
      if (edition) return edition.label[language] ?? edition.label.es ?? edition.name
      if (pokedexRegion) return regionLabel(pokedexRegion, language)
    } else {
      const version = pokedexCatalog.versions.find((v) => v.name === versionName)
      if (version) return version.label[language] ?? version.label.es ?? version.name
    }
    return t('list.scopeRegional')
  })()

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1 className={styles.title}>{t('list.title')}</h1>
        </div>
        <div className={styles.headerControls}>
          <PokedexScopeSelector
            pokedexScope={pokedexScope}
            onSetScope={setPokedexScope}
            pokedexMode={pokedexMode}
            onSetMode={setPokedexMode}
            pokedexRegion={pokedexRegion}
            onSetRegion={setPokedexRegion}
            pokedexName={pokedexName}
            onSetPokedexName={setPokedexName}
            pokedexOptionsForRegion={pokedexOptionsForRegion}
            versionName={versionName}
            onSetVersionName={setVersionName}
            catalog={pokedexCatalog}
            language={language}
          />
          <button type="button" className={styles.reload} onClick={reload} disabled={status === 'loading'}>
            {status === 'loading' ? t('list.loading') : t('list.reload')}
          </button>
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
            filtering={filtering}
            resultCount={visible.length}
            sortKey={sortKey}
            onSetSortKey={setSortKey}
            sortDirection={sortDirection}
            onToggleSortDirection={toggleSortDirection}
          />

          {!filtering && !pokedexFilterActive && (
            <GenerationPager
              generations={generations}
              activeGeneration={activeGeneration}
              onSelect={setActiveGeneration}
            />
          )}

          {visible.length === 0 ? (
            <p className={styles.empty}>{t('list.emptyFiltered')}</p>
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
        </>
      )}
    </section>
  )
}
