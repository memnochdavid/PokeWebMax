import { useEffect, useRef, useState } from 'react'
import { ALL_TYPES, typeColor, typeIconUrl, typeName } from '../../utils/pokemonTypes.js'
import styles from './TypeSelect.module.css'

// Un <select> nativo no puede pintar icono+color por <option> de forma fiable entre
// navegadores — este es un desplegable propio (botón + lista flotante) para que el
// filtro de tipo se vea igual que un TypeBadge, no texto plano (pedido explícito de
// David: "los select deben ser más visuales, incluyendo los colores y el icono").
export default function TypeSelect({ value, onChange, language, placeholder }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const onClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const select = (type) => {
    onChange(type)
    setOpen(false)
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        style={value ? { background: typeColor(value), borderColor: typeColor(value), color: '#fff' } : undefined}
      >
        {value ? (
          <>
            <img className={styles.icon} src={typeIconUrl(value)} alt="" />
            {typeName(value, language)}
          </>
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
        )}
      </button>

      {open && (
        <ul className={styles.menu} role="listbox">
          <li>
            <button type="button" className={styles.option} onClick={() => select('')}>
              {placeholder}
            </button>
          </li>
          {ALL_TYPES.map((type) => (
            <li key={type}>
              <button
                type="button"
                className={styles.option}
                style={{ background: typeColor(type), color: '#fff' }}
                onClick={() => select(type)}
              >
                <img className={styles.icon} src={typeIconUrl(type)} alt="" />
                {typeName(type, language)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
