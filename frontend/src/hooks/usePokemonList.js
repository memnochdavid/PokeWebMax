import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import i18n from '../i18n.js'
import { getCachedPokemon, setCachedPokemon } from '../utils/pokemonListCache.js'

export default function usePokemonList() {
  const cached = getCachedPokemon()
  const [status, setStatus] = useState(cached ? 'success' : 'loading') // loading | success | error
  const [pokemon, setPokemon] = useState(cached ?? [])
  const [error, setError] = useState(null)

  const fetchList = useCallback(() => {
    setStatus('loading')
    setError(null)

    axios
      .get('/api/pokemon')
      .then(({ data }) => {
        const cachedOnly = data.filter((entry) => entry.cached)
        setCachedPokemon(cachedOnly)
        setPokemon(cachedOnly)
        setStatus('success')
      })
      .catch((err) => {
        setError(err.response?.data?.error ?? i18n.t('errors.unexpected'))
        setStatus('error')
      })
  }, [])

  useEffect(() => {
    if (!cached) fetchList()
    // Solo en el montaje: si ya había caché, no se repite el fetch — "reload" sigue
    // disponible para forzarlo a mano (botón Recargar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { status, pokemon, error, reload: fetchList }
}
