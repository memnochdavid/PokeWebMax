import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../contexts/LanguageContext.jsx'
import { generationRegion, generationRoman } from '../../utils/generations.js'
import styles from './GenerationPager.module.css'

export default function GenerationPager({ generations, activeGeneration, onSelect }) {
  const { t } = useTranslation()
  const { language } = useLanguage()

  return (
    <nav className={styles.pager} aria-label={t('generationPager.ariaLabel')}>
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
            <span className={styles.region}>{generationRegion(id, language)}</span>
            <span className={styles.count}>{count}</span>
          </button>
        )
      })}
    </nav>
  )
}
