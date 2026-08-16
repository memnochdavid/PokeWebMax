import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

// Solo estados (ok/error/pending/unknown), no texto ya traducido — el texto se resuelve
// en el render vía react-i18next (ver StatusPage.jsx), así que un cambio de idioma no
// deja frases viejas atrapadas en este estado.
const PENDING = { backend: 'pending', database: 'pending' }

export default function useServiceHealth() {
  const [state, setState] = useState(PENDING)

  const check = useCallback(() => {
    setState(PENDING)

    axios
      .get('/api/health')
      .then(({ data }) => {
        setState({
          backend: 'ok',
          database: data.database === 'ok' ? 'ok' : 'error',
        })
      })
      .catch(() => {
        setState({ backend: 'error', database: 'unknown' })
      })
  }, [])

  useEffect(() => {
    check()
  }, [check])

  return { ...state, retry: check }
}
