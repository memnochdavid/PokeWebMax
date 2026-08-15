import { useCallback, useState } from 'react'
import axios from 'axios'

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

    let pending
    try {
      const { data } = await axios.get(`/api/pokeapi/${resourceType}`)
      pending = data.filter((entry) => !entry.cached)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error inesperado.')
      setStatus('error')
      return
    }

    setTotal(pending.length)

    for (const entry of pending) {
      try {
        await axios.post(`/api/pokeapi/${resourceType}/cache/${entry.id}`)
      } catch {
        // se ignora un fallo puntual y se sigue con el resto
      }
      setDone((prev) => prev + 1)
    }

    setStatus('done')
  }, [resourceType])

  return { status, total, done, error, start }
}
