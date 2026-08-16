import { useCallback, useState } from 'react'
import { cacheAllPending } from '../utils/cachePokeApiResource.js'

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
      setError(err.response?.data?.error ?? 'Error inesperado.')
      setStatus('error')
      return
    }

    setStatus('done')
  }, [resourceType])

  return { status, total, done, error, start }
}
