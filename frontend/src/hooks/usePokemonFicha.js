import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import i18n from '../i18n.js'

export default function usePokemonFicha(idOrName) {
  const [status, setStatus] = useState('loading') // loading | success | error
  const [ficha, setFicha] = useState(null)
  const [error, setError] = useState(null)
  const [caching, setCaching] = useState(false)

  const load = useCallback(() => {
    setStatus('loading')
    setError(null)

    axios
      .get(`/api/pokemon/${idOrName}/ficha`)
      .then(({ data }) => {
        setFicha(data)
        setStatus('success')
      })
      .catch((err) => {
        setError(err.response?.data?.error ?? i18n.t('errors.unexpected'))
        setStatus('error')
      })
  }, [idOrName])

  useEffect(() => {
    load()
  }, [load])

  const cacheMissing = useCallback(async () => {
    setCaching(true)
    try {
      const { data } = await axios.post(`/api/pokemon/${idOrName}/ficha/cache-missing`)
      setFicha(data)
    } catch (err) {
      setError(err.response?.data?.error ?? i18n.t('errors.unexpected'))
    } finally {
      setCaching(false)
    }
  }, [idOrName])

  return { status, ficha, error, caching, reload: load, cacheMissing }
}
