import { useState } from 'react'

export default function useVideoFallback() {
  const [failed, setFailed] = useState(false)
  return { failed, onError: () => setFailed(true) }
}
