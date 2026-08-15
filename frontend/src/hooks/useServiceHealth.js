import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

const PENDING = { state: 'pending', value: 'comprobando…' }

export default function useServiceHealth() {
  const [backend, setBackend] = useState(PENDING)
  const [database, setDatabase] = useState(PENDING)

  const check = useCallback(() => {
    setBackend(PENDING)
    setDatabase(PENDING)

    axios
      .get('/api/health')
      .then(({ data }) => {
        setBackend({ state: 'ok', value: 'conectado' })
        setDatabase(
          data.database === 'ok'
            ? { state: 'ok', value: 'conectada' }
            : { state: 'error', value: 'sin conexión' },
        )
      })
      .catch(() => {
        setBackend({ state: 'error', value: 'sin conexión' })
        setDatabase({ state: 'error', value: 'desconocido' })
      })
  }, [])

  useEffect(() => {
    check()
  }, [check])

  return { backend, database, retry: check }
}
