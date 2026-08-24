import styles from './ViewModeToggle.module.css'

// Grupo de botones tipo segmented control — genérico a propósito (recibe `modes`) para
// que un segundo modo de vista futuro (además de tarjetas/tabla) no necesite tocar este
// componente, solo la lista de opciones de quien lo use. `icon` es opcional por
// modo — si se pasa, el botón se vuelve icon-only (con `title`/`aria-label` sacados de
// `label` para no perder accesibilidad); si no, se sigue viendo el texto de siempre
// (uso actual en ItemsListPage, que sí tiene sitio de sobra para texto).
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
          title={mode.icon ? mode.label : undefined}
          aria-label={mode.icon ? mode.label : undefined}
        >
          {mode.icon ?? mode.label}
        </button>
      ))}
    </div>
  )
}
