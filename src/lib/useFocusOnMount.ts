import { useEffect, useRef } from 'react'

/**
 * Focus the element once, when it mounts, e.g. a panel's heading
 * (tabIndex -1) so keyboard focus follows a country as it opens instead of
 * falling back to <body>. Scrolling is left alone.
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return ref
}
