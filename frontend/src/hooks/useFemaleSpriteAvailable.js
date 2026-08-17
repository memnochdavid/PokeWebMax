import { useEffect, useState } from 'react'
import { femaleAnimatedSpriteUrl } from '../utils/animatedSprite.js'

// El pack de animados solo tiene variante "_hembra" para un subconjunto de especies
// con dimorfismo visual (Meowstic, Pyroar, Frillish...) — no hay forma de saberlo de
// antemano sin comprobar si el archivo existe de verdad (public/animated/ está
// gitignored, ni siquiera está en el repo). Un HEAD es suficiente y barato.
export default function useFemaleSpriteAvailable(pokemonApiName) {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    setAvailable(false)
    if (!pokemonApiName) return undefined

    let cancelled = false
    fetch(femaleAnimatedSpriteUrl(pokemonApiName), { method: 'HEAD' })
      .then((res) => {
        // El servidor de dev de Vite (y probablemente cualquier fallback de SPA)
        // responde 200 con index.html para rutas que no existen, así que `res.ok` NO
        // basta — hay que comprobar que de verdad es un vídeo, no el shell de la app
        // (verificado con curl: bulbasaur_hembra.webm, que no existe, daba 200
        // text/html en vez de 404).
        const isVideo = res.ok && (res.headers.get('content-type') ?? '').startsWith('video/')
        if (!cancelled) setAvailable(isVideo)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [pokemonApiName])

  return available
}
