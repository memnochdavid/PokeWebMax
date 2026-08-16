import { useCallback, useState } from 'react'
import { RESOURCE_GROUPS } from '../utils/pokeApiResources.js'
import { cacheAllPending } from '../utils/cachePokeApiResource.js'
import i18n from '../i18n.js'
import { invalidatePokemonCache } from '../utils/pokemonListCache.js'

const ALL_RESOURCE_TYPES = RESOURCE_GROUPS.flatMap((group) => group.resources.map((r) => r.type))

// Botón maestro de /cache: recorre los 49 resourceTypes en secuencia y cachea lo
// pendiente de cada uno, reutilizando la misma lógica que el botón por-recurso
// (cacheAllPending) para no repetirla.
export default function useCacheEverything() {
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [currentType, setCurrentType] = useState(null)
  const [resourcesDone, setResourcesDone] = useState(0)
  const [error, setError] = useState(null)

  const start = useCallback(async () => {
    setStatus('running')
    setError(null)
    setResourcesDone(0)

    for (const resourceType of ALL_RESOURCE_TYPES) {
      setCurrentType(resourceType)
      try {
        await cacheAllPending(resourceType)
      } catch (err) {
        setError(err.response?.data?.error ?? i18n.t('cache.errorCaching', { resourceType }))
        setStatus('error')
        return
      }
      setResourcesDone((prev) => prev + 1)
    }

    invalidatePokemonCache() // recorre los 49 tipos, siempre incluye pokemon/pokemon-species
    setCurrentType(null)
    setStatus('done')
  }, [])

  return {
    status,
    currentType,
    resourcesDone,
    totalResources: ALL_RESOURCE_TYPES.length,
    error,
    start,
  }
}
