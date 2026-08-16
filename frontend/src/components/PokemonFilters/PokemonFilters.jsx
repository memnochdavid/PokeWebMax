import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../contexts/LanguageContext.jsx'
import { ALL_TYPES, typeName } from '../../utils/pokemonTypes.js'
import { SORTS } from '../../hooks/usePokemonBrowser.js'
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
}) {
  const { language } = useLanguage()
  const { t } = useTranslation()

  return (
    <div className={styles.panel}>
      <div className={styles.searchRow}>
        <input
          type="search"
          className={styles.search}
          placeholder={t('filters.searchPlaceholder')}
          value={filters.query}
          onChange={(e) => onSetFilter('query', e.target.value)}
        />
        <select
          className={styles.select}
          value={filters.type1}
          onChange={(e) => onSetFilter('type1', e.target.value)}
        >
          <option value="">{t('filters.type1')}</option>
          {ALL_TYPES.map((type) => (
            <option key={type} value={type}>
              {typeName(type, language)}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={filters.type2}
          onChange={(e) => onSetFilter('type2', e.target.value)}
        >
          <option value="">{t('filters.type2')}</option>
          {ALL_TYPES.map((type) => (
            <option key={type} value={type}>
              {typeName(type, language)}
            </option>
          ))}
        </select>

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
