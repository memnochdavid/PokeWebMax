import { useState } from 'react'

// Modo de vista de la lista (tarjetas/tabla, más adelante quizá otros) persistido en
// localStorage — mismo criterio try/catch de ThemeContext/LanguageContext (modo
// privado u otros casos sin localStorage disponible: se pierde al recargar, no es
// grave). Un hook simple en vez de Context porque hoy solo lo consume PokemonListPage;
// si un segundo listado lo necesita, promocionarlo a Context entonces.
const STORAGE_KEY = 'pokewebmax:pokemonListViewMode'

function readStoredMode(validModes, fallback) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return validModes.includes(stored) ? stored : fallback
  } catch {
    return fallback
  }
}

export default function useViewMode(validModes, fallback) {
  const [mode, setModeState] = useState(() => readStoredMode(validModes, fallback))

  const setMode = (next) => {
    setModeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage no disponible — se pierde al recargar, no es grave
    }
  }

  return [mode, setMode]
}
