import { createContext, useCallback, useContext, useState } from 'react'

// Claro/oscuro vía `data-theme` en <html> (ver index.css: sin el atributo, sigue
// prefers-color-scheme del sistema; con él, lo fuerza en cualquier dirección). Solo se
// escribe el atributo cuando el usuario ha tocado el interruptor — antes de eso el
// tema sigue al sistema sin más, no hay una "elección" que persistir todavía.
const STORAGE_KEY = 'pokewebmax:theme'

const ThemeContext = createContext(null)

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

function systemTheme() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function ThemeProvider({ children }) {
  // null = sin elección explícita todavía, sigue al sistema. `theme` (el valor
  // efectivo que se muestra) se deriva de esto + la preferencia del sistema, nunca al
  // revés — así el interruptor sabe hacia dónde cambiar aunque el usuario nunca lo
  // haya tocado antes.
  const [explicitTheme, setExplicitTheme] = useState(readStoredTheme)
  const theme = explicitTheme ?? systemTheme()

  // Igual que i18next en LanguageContext: sincroniza el atributo del DOM durante el
  // render, no en un efecto, para no parpadear en el tema por defecto al cargar.
  if (document.documentElement.getAttribute('data-theme') !== explicitTheme) {
    if (explicitTheme) {
      document.documentElement.setAttribute('data-theme', explicitTheme)
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }

  const toggleTheme = useCallback(() => {
    setExplicitTheme((prev) => {
      const next = (prev ?? systemTheme()) === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // localStorage no disponible (modo privado, etc.) — se pierde al recargar, no es grave
      }
      return next
    })
  }, [])

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  }
  return ctx
}
