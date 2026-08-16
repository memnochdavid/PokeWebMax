import { createContext, useCallback, useContext, useState } from 'react'

// Idiomas del selector — no de la interfaz (que se queda en español, como el resto de
// la app), solo de los DATOS de PokeAPI (nombres, descripciones...). Añadir uno nuevo
// aquí es en principio suficiente en el frontend; en el backend hay que sincronizar
// PokemonListService::SUPPORTED_LANGUAGES si ese idioma debe llegar también a
// /api/pokemon/names (lista + nombres de la cadena evolutiva en la ficha).
export const LANGUAGES = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
]

const STORAGE_KEY = 'pokewebmax:language'
const DEFAULT_LANGUAGE = 'es'

const LanguageContext = createContext(null)

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return LANGUAGES.some((l) => l.code === stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage)

  const setLanguage = useCallback((code) => {
    setLanguageState(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // localStorage no disponible (modo privado, etc.) — se pierde al recargar, no es grave
    }
  }, [])

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage debe usarse dentro de <LanguageProvider>')
  }
  return ctx
}
