import { useState } from 'react'

// Modo de vista de una lista (tarjetas/tabla, más adelante quizá otros) persistido en
// localStorage — mismo criterio try/catch de ThemeContext/LanguageContext (modo
// privado u otros casos sin localStorage disponible: se pierde al recargar, no es
// grave). Un hook simple en vez de Context porque cada listado (Pokémon, Objetos...)
// que lo usa pasa su propia `storageKey` — así la preferencia de una lista no pisa la
// de otra, aunque ambas usen los mismos `validModes` ('grid'/'table').
function readStoredMode(storageKey, validModes, fallback) {
  try {
    const stored = localStorage.getItem(storageKey)
    return validModes.includes(stored) ? stored : fallback
  } catch {
    return fallback
  }
}

export default function useViewMode(validModes, fallback, storageKey) {
  const [mode, setModeState] = useState(() => readStoredMode(storageKey, validModes, fallback))

  const setMode = (next) => {
    setModeState(next)
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // localStorage no disponible — se pierde al recargar, no es grave
    }
  }

  return [mode, setMode]
}
