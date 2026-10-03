import { useEffect, useState } from 'react'

const MOBILE_QUERY = '(max-width: 768px), (max-height: 500px)'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    return window.matchMedia(MOBILE_QUERY).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const handler = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }
    const onResize = () => {
      setIsMobile(mql.matches)
    }

    setIsMobile(mql.matches)
    mql.addEventListener('change', handler)
    window.addEventListener('resize', onResize)
    return () => {
      mql.removeEventListener('change', handler)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return isMobile
}
