import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../contexts/LanguageContext.jsx'
import { SORTS } from '../../hooks/usePokemonBrowser.js'
import TypeSelect from '../TypeSelect/TypeSelect.jsx'
import styles from './PokemonFilters.module.css'

const TOGGLES = [
  { key: 'legendary', labelKey: 'filters.toggleLegendary' },
  { key: 'mythical', labelKey: 'filters.toggleMythical' },
  { key: 'mega', labelKey: 'filters.toggleMega' },
  { key: 'gmax', labelKey: 'filters.toggleGmax' },
  { key: 'regional', labelKey: 'filters.toggleRegional' },
]

export default function PokemonFilters({
  filters,
  onSetFilter,
  onReset,
  filtering,
  resultCount,
  sortKey,
  onSetSortKey,
  sortDirection,
  onToggleSortDirection,
  headerControls,
}) {
  const { language } = useLanguage()
  const { t } = useTranslation()

  return (
    <div className={styles.panel}>
      {headerControls && <div className={styles.controlsRow}>{headerControls}</div>}

      <div className={styles.searchRow}>
        <input
          type="search"
          className={styles.search}
          placeholder={t('filters.searchPlaceholder')}
          value={filters.query}
          onChange={(e) => onSetFilter('query', e.target.value)}
        />
        <TypeSelect
          value={filters.type1}
          onChange={(value) => onSetFilter('type1', value)}
          language={language}
          placeholder={t('filters.type1')}
        />
        <TypeSelect
          value={filters.type2}
          onChange={(value) => onSetFilter('type2', value)}
          language={language}
          placeholder={t('filters.type2')}
        />

        <div className={styles.sortGroup}>
          <span className={styles.evoLabel}>{t('filters.sortBy')}</span>
          <select className={styles.select} value={sortKey} onChange={(e) => onSetSortKey(e.target.value)}>
            {Object.entries(SORTS).map(([key, { labelKey }]) => (
              <option key={key} value={key}>
                {t(labelKey)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.toggle}
            onClick={onToggleSortDirection}
            aria-label={t(sortDirection === 'asc' ? 'filters.sortDirectionAsc' : 'filters.sortDirectionDesc')}
            title={t(sortDirection === 'asc' ? 'filters.sortDirectionAsc' : 'filters.sortDirectionDesc')}
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div className={styles.toggleRow}>
        {TOGGLES.map(({ key, labelKey }) => (
          <button
            key={key}
            type="button"
            className={`${styles.toggle} ${filters[key] ? styles.toggleActive : ''}`}
            onClick={() => onSetFilter(key, !filters[key])}
          >
            {t(labelKey)}
          </button>
        ))}

        <div className={styles.evoGroup}>
          <span className={styles.evoLabel}>{t('filters.stages')}</span>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.toggle} ${filters.evolutionStages === n ? styles.toggleActive : ''}`}
              onClick={() => onSetFilter('evolutionStages', filters.evolutionStages === n ? null : n)}
            >
              {n}
            </button>
          ))}
        </div>

        {filtering && (
          <button type="button" className={styles.clear} onClick={onReset}>
            {t('filters.clear')}
          </button>
        )}
      </div>

      {filtering && <p className={styles.resultCount}>{t('filters.results', { count: resultCount })}</p>}
    </div>
  )
}
