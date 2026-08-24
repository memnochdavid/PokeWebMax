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

// Estructura (header fijo + contenido con scroll interno + footer fijo con el
// contador, secciones con etiqueta propia, etapas como segmented control) calcada de
// la DISTRIBUCIÓN de un mockup que David le pidió a Stitch (Google) 2026-08-24 — a
// propósito solo la distribución, no sus colores/tipografía (ese mockup era
// Material Design + Tailwind, incompatible con el criterio del proyecto de CSS
// Modules sin Tailwind, ver CLAUDE.md). Todo el color/fuente sigue saliendo de los
// tokens de siempre (--chassis-*, --signal, --font-mono/--font-display).
// De regalo: el panel ya recibía un alto real estirado por el grid de
// PokemonListPage (ver `.layout` ahí), pero antes ese alto solo era "espacio de
// sobra" — si el contenido (chips + generaciones) llegaba a superarlo se desbordaba
// en silencio. Ahora ese alto se reparte en 3 franjas y solo `.content` hace scroll,
// mismo patrón ya usado en `.results` de PokemonListPage.
export default function PokemonFilters({
  filters,
  onSetFilter,
  resultCount,
  sortKey,
  onSetSortKey,
  sortDirection,
  onToggleSortDirection,
  headerActions,
  pokedexSelector,
  generationPager,
}) {
  const { language } = useLanguage()
  const { t } = useTranslation()

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.heading}>{t('filters.title')}</h2>
        {headerActions && <div className={styles.headerActions}>{headerActions}</div>}
      </header>

      <div className={styles.content}>
        {pokedexSelector && (
          <>
            <section className={styles.section}>
              <span className={styles.sectionLabel}>{t('filters.pokedexSection')}</span>
              {pokedexSelector}
            </section>
            <div className={styles.divider} />
          </>
        )}

        <section className={styles.section}>
          <div className={styles.searchRow}>
            <input
              type="search"
              className={styles.search}
              placeholder={t('filters.searchPlaceholder')}
              value={filters.query}
              onChange={(e) => onSetFilter('query', e.target.value)}
            />
            <div className={styles.typeRow}>
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
            </div>
          </div>
        </section>

        <div className={styles.divider} />

        <section className={styles.section}>
          <span className={styles.sectionLabel}>{t('filters.sortBy')}</span>
          <div className={styles.sortRow}>
            <select className={styles.select} value={sortKey} onChange={(e) => onSetSortKey(e.target.value)}>
              {Object.entries(SORTS).map(([key, { labelKey }]) => (
                <option key={key} value={key}>
                  {t(labelKey)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.sortDirection}
              onClick={onToggleSortDirection}
              aria-label={t(sortDirection === 'asc' ? 'filters.sortDirectionAsc' : 'filters.sortDirectionDesc')}
              title={t(sortDirection === 'asc' ? 'filters.sortDirectionAsc' : 'filters.sortDirectionDesc')}
            >
              {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <span className={styles.sectionLabel}>{t('filters.categories')}</span>
          <div className={styles.chipsRow}>
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
          </div>
        </section>

        <section className={styles.section}>
          <span className={styles.sectionLabel}>{t('filters.stages')}</span>
          {/* Segmented control (un solo track, no 3 pastillas sueltas) — idea tomada
              del mockup de Stitch: dado que solo puede haber una etapa activa a la
              vez (o ninguna), un track compacto comunica mejor "elige una" que 3
              botones independientes. */}
          <div className={styles.stages}>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                className={`${styles.stage} ${filters.evolutionStages === n ? styles.stageActive : ''}`}
                onClick={() => onSetFilter('evolutionStages', filters.evolutionStages === n ? null : n)}
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        {generationPager && (
          <section className={styles.section}>
            <span className={styles.sectionLabel}>{t('filters.generation')}</span>
            {generationPager}
          </section>
        )}
      </div>

      <footer className={styles.footer}>
        <span className={styles.resultPill}>{t('filters.results', { count: resultCount })}</span>
      </footer>
    </div>
  )
}
