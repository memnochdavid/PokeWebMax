import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useImageFallback from '../../hooks/useImageFallback.js'
import { itemIconUrl, itemFallbackSpriteUrl } from '../../utils/itemSprite.js'
import { itemCategoryName, itemPocketName } from '../../utils/itemCategories.js'
import { capitalize } from '../../utils/pokemonFormat.js'
import styles from './ItemTable.module.css'

function Sprite({ name, displayName }) {
  const image = useImageFallback(itemIconUrl(name), itemFallbackSpriteUrl(name))
  return (
    <img
      className={styles.sprite}
      src={image.src}
      onError={image.onError}
      alt={displayName}
      width={32}
      height={32}
      loading="lazy"
      decoding="async"
    />
  )
}

// Mismo criterio de columnas fijas (sin ordenar por cabecera, a diferencia de
// PokemonTable) que la vista de tarjetas de esta misma página: un modo de vista
// alternativo, no una herramienta de análisis nueva — la búsqueda/filtro de bolsillo ya
// existentes siguen siendo la forma de acotar la lista.
export default function ItemTable({ entries, language }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.spriteHeader} aria-hidden="true" />
            <th>{t('items.colName')}</th>
            <th>{t('items.colCategory')}</th>
            <th>{t('items.colPocket')}</th>
            <th>{t('items.colMove')}</th>
            <th>{t('items.cost')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const displayName = entry.names?.[language] ?? capitalize(entry.name.replace(/-/g, ' '))
            const moveLabel = entry.move?.names?.[language] ?? entry.move?.name
            return (
              <tr key={entry.id} className={styles.row} onClick={() => navigate(`/objetos/${entry.name}`)}>
                <td className={styles.spriteCell}>
                  <Sprite name={entry.name} displayName={displayName} />
                </td>
                <td className={styles.name}>{displayName}</td>
                <td>{itemCategoryName(entry.category, language) ?? '—'}</td>
                <td>{itemPocketName(entry.pocket, language) ?? '—'}</td>
                <td>{moveLabel ?? '—'}</td>
                <td>{entry.cost ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
