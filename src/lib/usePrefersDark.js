import { useEffect, useState } from 'react'

export function usePrefersDark() {
  const query = '(prefers-color-scheme: dark)'
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e) => setPrefersDark(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return prefersDark
}
