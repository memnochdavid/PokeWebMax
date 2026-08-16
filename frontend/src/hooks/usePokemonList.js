import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

export default function usePokemonList() {
  const [status, setStatus] = useState('loading') // loading | success | error
  const [pokemon, setPokemon] = useState([])
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setStatus('loading')
    setError(null)

    axios
      .get('/api/pokemon')
      .then(({ data }) => {
        setPokemon(data.filter((entry) => entry.cached))
        setStatus('success')
      })
      .catch((err) => {
        setError(err.response?.data?.error ?? 'Error inesperado.')
        setStatus('error')
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { status, pokemon, error, reload: load }
}
