import { useEffect, useRef } from 'react'
import { focusOnMount } from './panelFocus'
import { currentFocusState, FOCUS_SCOPE_ATTR } from './usePanelFocus'

/**
 * Focus the element once, when it mounts, e.g. a panel's heading
 * (tabIndex -1) so keyboard focus follows a country as it opens instead of
 * falling back to <body>. Not if focus is already inside the same
 * `data-focus-scope` (the sheet handle that just expanded or collapsed the
 * sheet keeps it). Scrolling is left alone.
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (focusOnMount(currentFocusState(el.closest(`[${FOCUS_SCOPE_ATTR}]`)))) el.focus({ preventScroll: true })
  }, [])
  return ref
}
