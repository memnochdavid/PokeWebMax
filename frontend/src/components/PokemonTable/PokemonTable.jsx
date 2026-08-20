import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TypeBadge from '../TypeBadge/TypeBadge.jsx'
import useImageFallback from '../../hooks/useImageFallback.js'
import { SORTS } from '../../hooks/usePokemonBrowser.js'
import { spriteHomeUrl, officialArtworkUrl } from '../../utils/spritesHome.js'
import { capitalize, formatPokedexNumber } from '../../utils/pokemonFormat.js'
import styles from './PokemonTable.module.css'

// Columnas ordenables — mismas claves que SORTS (usePokemonBrowser.js), una sola
// fuente de verdad con el selector de "Ordenar por" de PokemonFilters: clicar una
// cabecera hace exactamente lo mismo que elegirla ahí.
const COLUMNS = ['number', 'name', 'type', 'height', 'weight', 'captureRate', 'statsTotal']

function formatHeight(height) {
  return height != null ? `${(height / 10).toFixed(1)} m` : '—'
}

function formatWeight(weight) {
  return weight != null ? `${(weight / 10).toFixed(1)} kg` : '—'
}

function Sprite({ id }) {
  const image = useImageFallback(spriteHomeUrl(id), officialArtworkUrl(id))
  return <img className={styles.sprite} src={image.src} onError={image.onError} alt="" width={40} height={40} loading="lazy" decoding="async" />
}

export default function PokemonTable({ entries, names, language, sortKey, sortDirection, onSetSortKey, onToggleSortDirection }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleHeaderClick = (key) => {
    if (sortKey === key) onToggleSortDirection()
    else onSetSortKey(key)
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.spriteHeader} aria-hidden="true" />
            {COLUMNS.map((key) => (
              <th key={key}>
                <button type="button" className={styles.headerButton} onClick={() => handleHeaderClick(key)}>
                  {t(SORTS[key].labelKey)}
                  {sortKey === key && (
                    <span className={styles.arrow}>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const displayName = names[entry.id]?.names[language] ?? capitalize(entry.name.replace(/-/g, ' '))
            return (
              <tr key={entry.id} className={styles.row} onClick={() => navigate(`/ficha/${entry.name ?? entry.id}`)}>
                <td className={styles.spriteCell}>
                  <Sprite id={entry.id} />
                </td>
                <td className={styles.number}>{formatPokedexNumber(entry.displayNumber ?? entry.id)}</td>
                <td className={styles.name}>{displayName}</td>
                <td>
                  <div className={styles.types}>
                    {entry.types.map((type) => (
                      <TypeBadge key={type} type={type} />
                    ))}
                  </div>
                </td>
                <td>{formatHeight(entry.height)}</td>
                <td>{formatWeight(entry.weight)}</td>
                <td>{entry.captureRate ?? '—'}</td>
                <td>{entry.statsTotal ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
