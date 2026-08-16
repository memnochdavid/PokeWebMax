import { useState } from 'react'

// Intenta primarySrc primero; si falla al cargar (404, no descargado todavía...), cae a
// fallbackSrc. Usado para preferir el sprite local de sprites_home/ sin romper la UI
// cuando ese Pokémon en concreto no está en el pack descargado.
export default function useImageFallback(primarySrc, fallbackSrc) {
  const [failed, setFailed] = useState(false)

  return {
    src: !failed && primarySrc ? primarySrc : fallbackSrc,
    onError: () => setFailed(true),
  }
}
