import { createContext, useCallback, useContext, useState } from 'react'
import i18next from '../i18n.js'

// Un único selector para el idioma de los DATOS de PokeAPI (nombres, descripciones...)
// Y de la interfaz (nav, botones, mensajes — vía react-i18next, ver i18n.js).
// LanguageContext es la fuente de verdad (persiste en localStorage); i18next solo
// refleja el mismo valor. Añadir un idioma nuevo aquí requiere también: (a) un bloque
// de traducción en locales/es.json y locales/en.json (o el nuevo idioma) para la
// interfaz, y (b) sincronizar PokemonListService::SUPPORTED_LANGUAGES en el backend si
// ese idioma debe llegar también a /api/pokemon/names (lista + nombres de la cadena
// evolutiva en la ficha).
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

  // Sincroniza i18next ANTES de que se monten los hijos (durante el render, no en un
  // efecto) para que no haya un parpadeo en español al cargar con 'en' persistido.
  // changeLanguage() es idempotente, así que el doble render de StrictMode no molesta.
  if (i18next.language !== language) {
    i18next.changeLanguage(language)
  }

  const setLanguage = useCallback((code) => {
    setLanguageState(code)
    i18next.changeLanguage(code)
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
