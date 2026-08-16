import { useState } from 'react'

export default function useSelectedVersion() {
  const [version, setVersion] = useState(null)
  return { version, setVersion }
}
