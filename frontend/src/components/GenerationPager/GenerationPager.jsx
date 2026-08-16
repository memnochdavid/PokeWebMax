import { generationRegion, generationRoman } from '../../utils/generations.js'
import styles from './GenerationPager.module.css'

export default function GenerationPager({ generations, activeGeneration, onSelect }) {
  return (
    <nav className={styles.pager} aria-label="Generación">
      {generations.map(({ id, count }) => {
        const active = id === activeGeneration
        return (
          <button
            key={id}
            type="button"
            className={`${styles.tab} ${active ? styles.tabActive : ''}`}
            onClick={() => onSelect(id)}
          >
            <span className={styles.roman}>{generationRoman(id)}</span>
            <span className={styles.region}>{generationRegion(id)}</span>
            <span className={styles.count}>{count}</span>
          </button>
        )
      })}
    </nav>
  )
}
