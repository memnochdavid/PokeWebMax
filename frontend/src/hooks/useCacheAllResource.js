import { useCallback, useState } from 'react'
import { cacheAllPending } from '../utils/cachePokeApiResource.js'
import i18n from '../i18n.js'
import { invalidatePokemonCache } from '../utils/pokemonListCache.js'

// Recursos cuyo cambio afecta a lo que muestra /pokemon (cached/types/peso/altura/
// stats) — cachear cualquier otra cosa (item, move, location...) no vuelve obsoleta
// la lista, así que no hace falta invalidarla.
const AFFECTS_POKEMON_LIST = new Set(['pokemon-species', 'pokemon'])

export default function useCacheAllResource(resourceType) {
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [total, setTotal] = useState(0)
  const [done, setDone] = useState(0)
  const [error, setError] = useState(null)

  const start = useCallback(async () => {
    setStatus('running')
    setError(null)
    setDone(0)
    setTotal(0)

    try {
      await cacheAllPending(resourceType, {
        onTotal: setTotal,
        onProgress: (count) => setDone((prev) => prev + count),
      })
    } catch (err) {
      setError(err.response?.data?.error ?? i18n.t('errors.unexpected'))
      setStatus('error')
      return
    }

    if (AFFECTS_POKEMON_LIST.has(resourceType)) invalidatePokemonCache()
    setStatus('done')
  }, [resourceType])

  return { status, total, done, error, start }
}
