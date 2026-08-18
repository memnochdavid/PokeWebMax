import { useState } from 'react'

// Intenta primarySrc primero; si falla al cargar (404, no descargado todavía...), cae a
// fallbackSrc. Usado para preferir el sprite local de sprites_home/ sin romper la UI
// cuando ese Pokémon en concreto no está en el pack descargado.
//
// `exhausted` avisa cuando TAMBIÉN falló fallbackSrc (o no había) — algunos objetos
// (ej. los caramelos de especie de Let's Go en itemSprite.js) no tienen icono ni en
// WikiDex ni en el propio repo de sprites de PokeAPI, así que el consumidor puede
// pintar un placeholder en vez de dejar el icono roto del navegador.
//
// Si primarySrc y fallbackSrc son la MISMA url (ej. itemIconUrl() ya devuelve ella
// misma la url remota cuando el objeto no está en el mapa local — no hay dos
// candidatos reales, solo uno) se trata como si no hubiera primario distinto: se va
// directo a "modo fallback" desde el primer render. Si no se hiciera así, tras el
// primer fallo el <img src> se reasignaría al mismo string de antes, el navegador no
// dispara un `onError` nuevo por un src sin cambios, y `exhausted` se quedaría
// atascado en `false` para siempre (bug real, visto con los objetos "caramelo").
export default function useImageFallback(primarySrc, fallbackSrc) {
  const [primaryFailed, setPrimaryFailed] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  const hasDistinctPrimary = Boolean(primarySrc) && primarySrc !== fallbackSrc
  const usingFallback = !hasDistinctPrimary || primaryFailed

  return {
    src: usingFallback ? fallbackSrc : primarySrc,
    exhausted: usingFallback && (fallbackFailed || !fallbackSrc),
    onError: () => (usingFallback ? setFallbackFailed(true) : setPrimaryFailed(true)),
  }
}
