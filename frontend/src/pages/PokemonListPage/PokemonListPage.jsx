import usePokemonList from '../../hooks/usePokemonList.js'
import PokemonCard from '../../components/PokemonCard/PokemonCard.jsx'
import styles from './PokemonListPage.module.css'

const officialArtworkUrl = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

export default function PokemonListPage() {
  const { status, pokemon, error, reload } = usePokemonList()

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Pokémon</h1>
        <button type="button" className={styles.reload} onClick={reload} disabled={status === 'loading'}>
          {status === 'loading' ? 'Cargando…' : 'Recargar'}
        </button>
      </div>

      {status === 'error' && <p className={styles.error}>{error}</p>}

      {status === 'success' && pokemon.length === 0 && (
        <p className={styles.empty}>Todavía no hay ningún Pokémon cacheado.</p>
      )}

      {pokemon.length > 0 && (
        <ul className={styles.grid}>
          {pokemon.map((entry) => (
            <li key={entry.id}>
              <PokemonCard id={entry.id} name={entry.name} sprite={officialArtworkUrl(entry.id)} types={entry.types} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
