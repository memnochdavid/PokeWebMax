import { useParams } from 'react-router-dom'
import usePokemonFicha from '../../hooks/usePokemonFicha.js'
import useFichaSection from '../../hooks/useFichaSection.js'
import useImageFallback from '../../hooks/useImageFallback.js'
import TypeBadge from '../../components/TypeBadge/TypeBadge.jsx'
import PokemonHeroSprite from '../../components/PokemonHeroSprite/PokemonHeroSprite.jsx'
import { typeColor } from '../../utils/pokemonTypes.js'
import { spriteHomeUrl } from '../../utils/spritesHome.js'
import { animatedSpriteUrl } from '../../utils/animatedSprite.js'
import { capitalize, formatPokedexNumber } from '../../utils/pokemonFormat.js'
import {
  FICHA_SECTIONS,
  flattenEvolutionChain,
  sectionMissingCount,
  spanishFlavorText,
  spanishGenus,
  totalMissing,
} from '../../utils/pokemonFicha.js'
import styles from './PokemonFichaPage.module.css'

const officialArtworkUrl = (id) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

export default function PokemonFichaPage() {
  const { idOrName } = useParams()
  const { status, ficha, error, caching, cacheMissing } = usePokemonFicha(idOrName)
  const { section, setSection } = useFichaSection('DESC')
  const pokemon = ficha?.pokemon
  const heroImage = useImageFallback(
    pokemon ? spriteHomeUrl(pokemon.id) : null,
    pokemon ? (pokemon.sprites.other?.['official-artwork']?.front_default ?? officialArtworkUrl(pokemon.id)) : null,
  )

  if (status === 'loading') return <p className={styles.status}>Cargando…</p>
  if (status === 'error') return <p className={styles.statusError}>{error}</p>
  if (!ficha) return null

  const { species, evolutionChain, moves, abilities, forms, missing } = ficha
  const types = pokemon.types.map((t) => t.type.name)
  const missingTotal = totalMissing(missing)

  return (
    <section className={styles.page}>
      <header
        className={styles.hero}
        style={{ background: `linear-gradient(90deg, ${typeColor(types[0])} 0%, ${typeColor(types[1] ?? types[0])} 100%)` }}
      >
        <PokemonHeroSprite
          className={styles.sprite}
          animatedSrc={animatedSpriteUrl(pokemon.name)}
          staticSrc={heroImage.src}
          staticOnError={heroImage.onError}
          alt={pokemon.name}
          width={180}
          height={180}
        />
        <div>
          <h1 className={styles.name}>{capitalize(pokemon.name)}</h1>
          <span className={styles.number}>{formatPokedexNumber(pokemon.id)}</span>
          <div className={styles.types}>
            {types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </div>
        </div>
      </header>

      {missingTotal > 0 && (
        <div className={styles.cacheBar}>
          <span>Faltan {missingTotal} recursos por cachear para completar esta ficha.</span>
          <button type="button" onClick={cacheMissing} disabled={caching}>
            {caching ? 'Cacheando…' : 'Cachear todo lo que falta'}
          </button>
        </div>
      )}

      <nav className={styles.tabs}>
        {FICHA_SECTIONS.map(({ key, label, missingKey }) => {
          const count = sectionMissingCount(missing, missingKey)
          return (
            <button
              key={key}
              type="button"
              className={section === key ? styles.tabActive : styles.tab}
              onClick={() => setSection(key)}
            >
              {label}
              {count > 0 && <span className={styles.badge}>{count}</span>}
            </button>
          )
        })}
      </nav>

      <div className={styles.content}>
        {section === 'DESC' && (
          <div>
            <p>{spanishGenus(species) ?? 'Género no disponible.'}</p>
            <p>{spanishFlavorText(species) ?? 'Descripción no disponible — cachea pokemon-species.'}</p>
            <p>Altura: {pokemon.height / 10} m · Peso: {pokemon.weight / 10} kg</p>
          </div>
        )}

        {section === 'STATS' && (
          <ul className={styles.stats}>
            {pokemon.stats.map((s) => (
              <li key={s.stat.name}>
                <span className={styles.statName}>{s.stat.name}</span>
                <span className={styles.statBarTrack}>
                  <span className={styles.statBarFill} style={{ width: `${Math.min(100, (s.base_stat / 255) * 100)}%` }} />
                </span>
                <span>{s.base_stat}</span>
              </li>
            ))}
          </ul>
        )}

        {section === 'EVOS' && (
          evolutionChain ? (
            <p className={styles.evoChain}>
              {flattenEvolutionChain(evolutionChain).map(capitalize).join(' → ')}
            </p>
          ) : (
            <p>Cadena evolutiva no cacheada todavía.</p>
          )
        )}

        {section === 'MOVES' && (
          <ul className={styles.list}>
            {moves.map((m) => (
              <li key={m.id}>
                {capitalize(m.name.replace(/-/g, ' '))}
                {!m.cached && <span className={styles.notCached}> — no cacheado</span>}
              </li>
            ))}
          </ul>
        )}

        {section === 'ABILITY' && (
          <ul className={styles.list}>
            {abilities.map((a) => (
              <li key={a.id}>
                {capitalize(a.name.replace(/-/g, ' '))}
                {!a.cached && <span className={styles.notCached}> — no cacheada</span>}
              </li>
            ))}
          </ul>
        )}

        {section === 'FORM' && (
          <ul className={styles.list}>
            {forms.map((f) => (
              <li key={f.id}>
                {capitalize(f.name.replace(/-/g, ' '))}
                {!f.cached && <span className={styles.notCached}> — no cacheada</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
