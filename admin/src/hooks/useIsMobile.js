import { useEffect, useState } from 'react'

/**
 * Detects whether the viewport matches a mobile breakpoint.
 * Uses matchMedia so it reacts instantly to rotation/resize.
 *
 * @param {number} [breakpoint=768] max-width in px
 * @returns {boolean}
 */
export default function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint}px)`

  const getMatch = () =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false

  const [isMobile, setIsMobile] = useState(getMatch)

  useEffect(() => {
    if (!window.matchMedia) return undefined

    const mql = window.matchMedia(query)
    const handler = (e) => setIsMobile(e.matches)

    // Modern API with legacy fallback
    if (mql.addEventListener) {
      mql.addEventListener('change', handler)
    } else {
      mql.addListener(handler)
    }

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handler)
      } else {
        mql.removeListener(handler)
      }
    }
  }, [query])

  return isMobile
}
