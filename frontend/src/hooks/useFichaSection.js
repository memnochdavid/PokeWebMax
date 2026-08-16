import { useState } from 'react'

export default function useFichaSection(initial) {
  const [section, setSection] = useState(initial)
  return { section, setSection }
}
