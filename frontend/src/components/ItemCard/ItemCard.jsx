import { Link } from 'react-router-dom'
import useImageFallback from '../../hooks/useImageFallback.js'
import { itemIconUrl, itemFallbackSpriteUrl } from '../../utils/itemSprite.js'
import styles from './ItemCard.module.css'

export default function ItemCard({ name, displayName, categoryLabel, moveLabel }) {
  const image = useImageFallback(itemIconUrl(name), itemFallbackSpriteUrl(name))

  return (
    <Link to={`/objetos/${name}`} className={styles.card}>
      <div className={`${styles.spriteWrap} hud-frame hud-frame--hover`}>
        <img
          className={styles.sprite}
          src={image.src}
          onError={image.onError}
          alt={displayName}
          width={56}
          height={56}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className={styles.info}>
        <strong className={styles.name}>{displayName}</strong>
        {moveLabel && <span className={styles.move}>{moveLabel}</span>}
        {categoryLabel && <span className={styles.category}>{categoryLabel}</span>}
      </div>
    </Link>
  )
}
