import { useEffect, useState } from 'react'
import {
  femaleAnimatedSpriteUrl,
  femaleShinyAnimatedSpriteUrl,
  shinyAnimatedSpriteUrl,
} from '../utils/animatedSprite.js'

const EMPTY = { hasFemale: false, hasShiny: false, hasFemaleShiny: false }

// El pack de animados solo tiene variante "_hembra" para un subconjunto de especies con
// dimorfismo visual (Meowstic, Pyroar, Frillish...) y no todas las bases tienen "_shiny"
// todavía (la reexportación a .webp que incluyó los shiny no llegó al 100% del pack) —
// no hay forma de saberlo de antemano sin comprobar si el archivo existe de verdad
// (public/animated/ está gitignored, ni siquiera está en el repo). Un HEAD por variante
// es suficiente y barato; se lanzan las tres en paralelo.
async function checkExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    // El servidor de dev de Vite (y probablemente cualquier fallback de SPA) responde
    // 200 con index.html para rutas que no existen, así que `res.ok` NO basta — hay que
    // comprobar que de verdad es una imagen, no el shell de la app.
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')
  } catch {
    return false
  }
}

export default function useAnimatedSpriteVariants(pokemonApiName) {
  const [variants, setVariants] = useState(EMPTY)

  useEffect(() => {
    setVariants(EMPTY)
    if (!pokemonApiName) return undefined

    let cancelled = false
    Promise.all([
      checkExists(femaleAnimatedSpriteUrl(pokemonApiName)),
      checkExists(shinyAnimatedSpriteUrl(pokemonApiName)),
      checkExists(femaleShinyAnimatedSpriteUrl(pokemonApiName)),
    ]).then(([hasFemale, hasShiny, hasFemaleShiny]) => {
      if (!cancelled) setVariants({ hasFemale, hasShiny, hasFemaleShiny })
    })

    return () => {
      cancelled = true
    }
  }, [pokemonApiName])

  return variants
}
