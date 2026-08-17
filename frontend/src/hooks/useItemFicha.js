import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import i18n from '../i18n.js'

export default function useItemFicha(idOrName) {
  const [status, setStatus] = useState('loading') // loading | success | error
  const [ficha, setFicha] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setStatus('loading')
    setError(null)

    axios
      .get(`/api/items/${idOrName}/ficha`)
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

  return { status, ficha, error, reload: load }
}
