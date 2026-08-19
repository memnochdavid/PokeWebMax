import { useCallback, useState } from 'react'
import axios from 'axios'
import i18n from '../i18n.js'
import { BATCH_SIZE } from '../utils/cachePokeApiResource.js'
import { invalidatePokemonCache } from '../utils/pokemonListCache.js'

// Cachea encuentros salvajes (POST /api/pokemon/encounters/cache-batch) SOLO para los
// ids que se le pasen — a diferencia de cacheAllPending() (todo un resourceType de
// PokeAPI de una vez), este cacheo es siempre contextual: los Pokémon de la Pokédex del
// juego que se esté mirando en la lista, nunca los ~1351 de golpe (decisión explícita
// de David, ver .claude/memory/project_pokewebmax_progress.md). Mismo BATCH_SIZE que el
// resto de cacheos por lotes.
export default function useCacheEncountersForIds() {
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [total, setTotal] = useState(0)
  const [done, setDone] = useState(0)
  const [error, setError] = useState(null)

  const start = useCallback(async (ids, { onDone } = {}) => {
    setStatus('running')
    setError(null)
    setDone(0)
    setTotal(ids.length)

    try {
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE)
        await axios.post('/api/pokemon/encounters/cache-batch', { ids: batch })
        setDone((prev) => prev + batch.length)
      }
    } catch (err) {
      setError(err.response?.data?.error ?? i18n.t('errors.unexpected'))
      setStatus('error')
      return
    }

    invalidatePokemonCache()
    setStatus('done')
    onDone?.()
  }, [])

  return { status, total, done, error, start }
}
