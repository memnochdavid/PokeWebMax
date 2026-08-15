import usePokemonList from '../../hooks/usePokemonList.js'
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
            <li key={entry.id} className={styles.card}>
              <img
                className={styles.sprite}
                src={officialArtworkUrl(entry.id)}
                alt={entry.name}
                width={64}
                height={64}
              />
              <strong>{entry.name}</strong>
              <span>#{entry.id}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
