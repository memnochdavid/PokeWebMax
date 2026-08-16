import { Link } from 'react-router-dom'
import TypeBadge from '../TypeBadge/TypeBadge.jsx'
import useImageFallback from '../../hooks/useImageFallback.js'
import { typeColor } from '../../utils/pokemonTypes.js'
import { spriteHomeUrl } from '../../utils/spritesHome.js'
import { capitalize, formatPokedexNumber } from '../../utils/pokemonFormat.js'
import styles from './PokemonCard.module.css'

export default function PokemonCard({ id, name, displayName, sprite, types = [] }) {
  const image = useImageFallback(spriteHomeUrl(id), sprite)

  const [color1, color2] = types.length > 0
    ? [typeColor(types[0]), typeColor(types[1] ?? types[0])]
    : ['#9c9c9c', '#7a7a7a']

  const background = { background: `linear-gradient(90deg, ${color1} 0%, ${color2} 100%)` }

  return (
    <Link to={`/ficha/${id}`} className={styles.card} style={background}>
      <span className={styles.number}>{formatPokedexNumber(id)}</span>
      <div className={`${styles.spriteWrap} hud-frame hud-frame--hover`} style={{ color: color1 }}>
        <img
          className={styles.sprite}
          src={image.src}
          onError={image.onError}
          alt={name}
          width={96}
          height={96}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className={styles.info}>
        <strong className={styles.name}>{displayName ?? capitalize(name)}</strong>
        {types.length > 0 && (
          <div className={styles.types}>
            {types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
