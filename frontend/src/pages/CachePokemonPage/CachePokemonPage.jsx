import useCachePokemon from '../../hooks/useCachePokemon.js'
import styles from './CachePokemonPage.module.css'

export default function CachePokemonPage() {
  const { idOrName, setIdOrName, status, result, error, submit } = useCachePokemon()

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Cachear Pokémon</h1>

      <form onSubmit={submit} className={styles.form}>
        <input
          type="text"
          className={styles.input}
          value={idOrName}
          onChange={(event) => setIdOrName(event.target.value)}
          placeholder="ID o nombre (ej: pikachu, 25)"
        />
        <button type="submit" className={styles.submit} disabled={status === 'loading'}>
          {status === 'loading' ? 'Cacheando…' : 'Cachear'}
        </button>
      </form>

      {status === 'success' && result && (
        <div className={styles.result}>
          {result.spriteUrl && (
            <img
              className={styles.sprite}
              src={result.spriteUrl}
              alt={result.name}
              width={96}
              height={96}
            />
          )}
          <p>
            <strong>{result.name}</strong> (#{result.id}) —{' '}
            {result.wasCached ? 'actualizado' : 'cacheado por primera vez'}
          </p>
          <p>Tipos: {result.types.join(', ')}</p>
        </div>
      )}

      {status === 'error' && <p className={styles.error}>{error}</p>}
    </section>
  )
}
