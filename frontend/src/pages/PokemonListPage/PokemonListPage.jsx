import { useTranslation } from 'react-i18next'
import usePokemonList from '../../hooks/usePokemonList.js'
import usePokemonBrowser from '../../hooks/usePokemonBrowser.js'
import usePokemonNames from '../../hooks/usePokemonNames.js'
import { useLanguage } from '../../contexts/LanguageContext.jsx'
import PokemonCard from '../../components/PokemonCard/PokemonCard.jsx'
import PokemonFilters from '../../components/PokemonFilters/PokemonFilters.jsx'
import GenerationPager from '../../components/GenerationPager/GenerationPager.jsx'
import { capitalize } from '../../utils/pokemonFormat.js'
import styles from './PokemonListPage.module.css'

const officialArtworkUrl = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

export default function PokemonListPage() {
  const { status, pokemon, error, reload } = usePokemonList()
  const { language } = useLanguage()
  const { t } = useTranslation()
  const names = usePokemonNames()
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
  } = usePokemonBrowser(pokemon, { names, language })

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className="eyebrow">{t('list.eyebrow')}</span>
          <h1 className={styles.title}>{t('list.title')}</h1>
        </div>
        <button type="button" className={styles.reload} onClick={reload} disabled={status === 'loading'}>
          {status === 'loading' ? t('list.loading') : t('list.reload')}
        </button>
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

          {!filtering && (
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
