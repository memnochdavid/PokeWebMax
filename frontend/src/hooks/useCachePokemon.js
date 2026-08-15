import { useCallback, useState } from 'react'
import axios from 'axios'

export default function useCachePokemon() {
  const [idOrName, setIdOrName] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const submit = useCallback(
    (event) => {
      event.preventDefault()
      const value = idOrName.trim()
      if (!value) return

      setStatus('loading')
      setError(null)
      setResult(null)

      axios
        .post(`/api/pokemon/cache/${encodeURIComponent(value)}`)
        .then(({ data }) => {
          setResult(data)
          setStatus('success')
        })
        .catch((err) => {
          setError(err.response?.data?.error ?? 'Error inesperado.')
          setStatus('error')
        })
    },
    [idOrName],
  )

  return { idOrName, setIdOrName, status, result, error, submit }
}
