import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import i18n from '../i18n.js'
import { getCachedItems, setCachedItems } from '../utils/itemListCache.js'

export default function useItemList() {
  const cached = getCachedItems()
  const [status, setStatus] = useState(cached ? 'success' : 'loading')
  const [items, setItems] = useState(cached ?? [])
  const [error, setError] = useState(null)

  const fetchList = useCallback(() => {
    setStatus('loading')
    setError(null)

    axios
      .get('/api/items')
      .then(({ data }) => {
        const cachedOnly = data.filter((entry) => entry.cached)
        setCachedItems(cachedOnly)
        setItems(cachedOnly)
        setStatus('success')
      })
      .catch((err) => {
        setError(err.response?.data?.error ?? i18n.t('errors.unexpected'))
        setStatus('error')
      })
  }, [])

  useEffect(() => {
    if (!cached) fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { status, items, error, reload: fetchList }
}
