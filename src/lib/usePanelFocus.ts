import { useLayoutEffect, useRef, type RefObject } from 'react'
import { focusState, openerFrom, returnFocusTarget } from './panelFocus'

/** Marks the sidebar / sheet root: focus inside it counts as `inside` (see `panelFocus`). */
export const FOCUS_SCOPE_ATTR = 'data-focus-scope'
/** Marks where focus lands on close when neither the row nor the opener can take it. */
export const FOCUS_FALLBACK_ATTR = 'data-focus-fallback'
/** Kept usable while a modal sheet makes the rest of the page inert (the toasts, with Undo). */
export const INERT_EXEMPT_ATTR = 'data-inert-exempt'

/** Whether focus can usefully go to `el`: still in the page, rendered, and not inside an inert subtree. */
export function isFocusable(el: HTMLElement): boolean {
  return el.isConnected && !el.closest('[inert]') && el.getClientRects().length > 0
}

/** The current focus relative to `scope` (the sidebar / sheet root). */
export function currentFocusState(scope: Element | null) {
  return focusState<Element>(document.activeElement, document.body, el => scope?.contains(el) ?? false)
}

/**
 * Make everything outside `el` inert (each ancestor's siblings, up to
 * <body>), except `INERT_EXEMPT_ATTR` subtrees and what was inert already.
 * Returns the undo.
 */
export function inertOthers(el: Element): () => void {
  const changed: Element[] = []
  for (let node: Element = el; node.parentElement && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || sibling.hasAttribute('inert') || sibling.hasAttribute(INERT_EXEMPT_ATTR)) continue
      if (sibling instanceof HTMLScriptElement || sibling instanceof HTMLStyleElement) continue
      sibling.setAttribute('inert', '')
      changed.push(sibling)
    }
  }
  return () => changed.forEach(sibling => sibling.removeAttribute('inert'))
}

/**
 * Return focus as the country panel closes. `openKey` is the open country
 * (`null` when the list shows). On opening, remember what had focus outside
 * the sidebar (e.g. the search box); on closing, if focus was lost (the
 * panel, its Back, the mobile ‹ or the map's World view went with it), move
 * it to the country's list row, else that opener, else the list heading.
 * Runs as a layout effect so the new list is in the DOM and a modal sheet's
 * inert is already undone, and before the panel's own mount focus.
 */
export function usePanelFocusReturn(scope: RefObject<HTMLElement>, openKey: string | null) {
  const previous = useRef(openKey)
  const opener = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const closedKey = previous.current
    previous.current = openKey
    if (closedKey === openKey) return
    const root = scope.current
    const state = currentFocusState(root)
    if (openKey) {
      // Opening (or switching country): keep the first opener.
      if (!closedKey) {
        const active = document.activeElement
        opener.current = openerFrom(active instanceof HTMLElement ? active : null, state)
      }
      return
    }
    if (!closedKey) return
    const rows = root ? [...root.querySelectorAll<HTMLElement>('[data-row]')] : []
    const target = returnFocusTarget(state, {
      row: rows.find(r => r.dataset.row === closedKey),
      opener: opener.current,
      fallbacks: [root?.querySelector<HTMLElement>(`[${FOCUS_FALLBACK_ATTR}]`)],
    }, isFocusable)
    opener.current = null
    target?.focus()
  }, [openKey, scope])
}
