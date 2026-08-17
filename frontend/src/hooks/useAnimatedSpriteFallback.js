import { useState } from 'react'

export default function useAnimatedSpriteFallback() {
  const [failed, setFailed] = useState(false)
  return { failed, onError: () => setFailed(true) }
}
