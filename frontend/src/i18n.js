import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './locales/es.json'
import en from './locales/en.json'

// Mismo idioma que LanguageContext (que ya persiste en localStorage y gobierna el
// idioma de los DATOS de PokeAPI) — una sola fuente de verdad para "qué idioma",
// LanguageProvider llama a i18next.changeLanguage() cuando cambia. i18next aquí solo
// resuelve el texto propio de la interfaz (nav, botones, mensajes); los catálogos de
// datos internos (pestañas de la ficha, etiquetas de recursos de PokeAPI, nombres de
// región) siguen el patrón bilingüe ya usado en el proyecto (ver damageClassName en
// utils/pokemonFicha.js) en vez de vivir aquí, porque son catálogos indexados por
// clave interna, no prosa de interfaz.
i18next.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
})

export default i18next
