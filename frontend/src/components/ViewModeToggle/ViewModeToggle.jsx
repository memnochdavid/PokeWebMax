import styles from './ViewModeToggle.module.css'

// Grupo de botones tipo segmented control — genérico a propósito (recibe `modes`) para
// que un segundo modo de vista futuro (además de tarjetas/tabla) no necesite tocar este
// componente, solo la lista de opciones de quien lo use.
export default function ViewModeToggle({ modes, value, onChange }) {
  return (
    <div className={styles.group} role="group">
      {modes.map((mode) => (
        <button
          key={mode.value}
          type="button"
          className={`${styles.option} ${value === mode.value ? styles.optionActive : ''}`}
          onClick={() => onChange(mode.value)}
          aria-pressed={value === mode.value}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}
