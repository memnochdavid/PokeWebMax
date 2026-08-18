import { Link } from 'react-router-dom'
import useImageFallback from '../../hooks/useImageFallback.js'
import { itemIconUrl, itemFallbackSpriteUrl } from '../../utils/itemSprite.js'
import styles from './ItemCard.module.css'

export default function ItemCard({ name, displayName, categoryLabel, moveLabel }) {
  const image = useImageFallback(itemIconUrl(name), itemFallbackSpriteUrl(name))

  return (
    <Link to={`/objetos/${name}`} className={styles.card}>
      <div className={`${styles.spriteWrap} hud-frame hud-frame--hover`}>
        {image.exhausted ? (
          <span className={styles.spritePlaceholder} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
              <path d="M3 8.5V16l9 4.5 9-4.5V8.5M12 13v7.5" />
            </svg>
          </span>
        ) : (
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
        )}
      </div>
      <div className={styles.info}>
        <strong className={styles.name}>{displayName}</strong>
        {moveLabel && <span className={styles.move}>{moveLabel}</span>}
        {categoryLabel && <span className={styles.category}>{categoryLabel}</span>}
      </div>
    </Link>
  )
}
