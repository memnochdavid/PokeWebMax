import usePokemonList from '../../hooks/usePokemonList.js'
import usePokemonBrowser from '../../hooks/usePokemonBrowser.js'
import PokemonCard from '../../components/PokemonCard/PokemonCard.jsx'
import PokemonFilters from '../../components/PokemonFilters/PokemonFilters.jsx'
import GenerationPager from '../../components/GenerationPager/GenerationPager.jsx'
import styles from './PokemonListPage.module.css'

const officialArtworkUrl = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

export default function PokemonListPage() {
  const { status, pokemon, error, reload } = usePokemonList()
  const { filters, setFilter, resetFilters, filtering, generations, activeGeneration, setActiveGeneration, visible } =
    usePokemonBrowser(pokemon)

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className="eyebrow">Pokédex nacional</span>
          <h1 className={styles.title}>Pokémon</h1>
        </div>
        <button type="button" className={styles.reload} onClick={reload} disabled={status === 'loading'}>
          {status === 'loading' ? 'Cargando…' : 'Recargar'}
        </button>
      </div>

      {status === 'error' && <p className={styles.error}>{error}</p>}

      {status === 'success' && pokemon.length === 0 && (
        <p className={styles.empty}>Todavía no hay ningún Pokémon cacheado.</p>
      )}

      {pokemon.length > 0 && (
        <>
          <PokemonFilters
            filters={filters}
            onSetFilter={setFilter}
            onReset={resetFilters}
            filtering={filtering}
            resultCount={visible.length}
          />

          {!filtering && (
            <GenerationPager
              generations={generations}
              activeGeneration={activeGeneration}
              onSelect={setActiveGeneration}
            />
          )}

          {visible.length === 0 ? (
            <p className={styles.empty}>Ningún Pokémon coincide con estos filtros.</p>
          ) : (
            <ul className={styles.grid}>
              {visible.map((entry) => (
                <li key={entry.id}>
                  <PokemonCard id={entry.id} name={entry.name} sprite={officialArtworkUrl(entry.id)} types={entry.types} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
