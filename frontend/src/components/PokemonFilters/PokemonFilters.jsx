import { ALL_TYPES, typeNameEs } from '../../utils/pokemonTypes.js'
import styles from './PokemonFilters.module.css'

const TOGGLES = [
  { key: 'legendary', label: 'Legendario' },
  { key: 'mythical', label: 'Singular' },
  { key: 'mega', label: 'Mega' },
  { key: 'gmax', label: 'Gigamax' },
  { key: 'regional', label: 'Regional' },
]

export default function PokemonFilters({ filters, onSetFilter, onReset, filtering, resultCount }) {
  return (
    <div className={styles.panel}>
      <div className={styles.searchRow}>
        <input
          type="search"
          className={styles.search}
          placeholder="Buscar por nombre…"
          value={filters.query}
          onChange={(e) => onSetFilter('query', e.target.value)}
        />
        <select
          className={styles.select}
          value={filters.type1}
          onChange={(e) => onSetFilter('type1', e.target.value)}
        >
          <option value="">Tipo 1</option>
          {ALL_TYPES.map((type) => (
            <option key={type} value={type}>
              {typeNameEs(type)}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={filters.type2}
          onChange={(e) => onSetFilter('type2', e.target.value)}
        >
          <option value="">Tipo 2</option>
          {ALL_TYPES.map((type) => (
            <option key={type} value={type}>
              {typeNameEs(type)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.toggleRow}>
        {TOGGLES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`${styles.toggle} ${filters[key] ? styles.toggleActive : ''}`}
            onClick={() => onSetFilter(key, !filters[key])}
          >
            {label}
          </button>
        ))}

        <div className={styles.evoGroup}>
          <span className={styles.evoLabel}>Etapas</span>
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
            Limpiar
          </button>
        )}
      </div>

      {filtering && (
        <p className={styles.resultCount}>
          {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
        </p>
      )}
    </div>
  )
}
