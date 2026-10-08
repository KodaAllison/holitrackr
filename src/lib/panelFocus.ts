/**
 * Where keyboard focus goes as the country panel (the desktop sidebar's
 * detail / mark panel, or the mobile sheet) opens and closes. Pure, with the
 * element type left generic, so the ordering is unit-tested; the DOM side is
 * `usePanelFocus`.
 */

/**
 * Where focus is relative to the sidebar:
 * - `lost`: on <body> (or nowhere), usually because the focused control was
 *   just removed, e.g. a list row the panel replaced, or the panel's Back.
 * - `inside`: on something inside the sidebar / sheet.
 * - `elsewhere`: on something the user put it on outside, e.g. the search.
 */
export type FocusState = 'lost' | 'inside' | 'elsewhere'

export function focusState<T>(active: T | null | undefined, body: T, inside: (el: T) => boolean): FocusState {
  if (!active || active === body) return 'lost'
  return inside(active) ? 'inside' : 'elsewhere'
}

/**
 * Whether a panel heading should take focus as it mounts. Not when focus is
 * already inside the sidebar, e.g. on the mobile sheet's handle as it
 * expands or collapses: that would yank it away from the control just used.
 */
export function focusOnMount(state: FocusState): boolean {
  return state !== 'inside'
}

/**
 * Whether Esc closes the collapsed mobile country card: not if something
 * already handled it (a popover, the search), nor while focus is out on
 * the map's controls or the search, where the map stays in use.
 */
export function escClosesSummary({ defaultPrevented, state }: { defaultPrevented: boolean; state: FocusState }): boolean {
  return !defaultPrevented && state !== 'elsewhere'
}

/** What had focus as a panel opened, worth returning to on close: only something outside the sidebar. */
export function openerFrom<T>(active: T | null | undefined, state: FocusState): T | null {
  return state === 'elsewhere' && active ? active : null
}

export interface ReturnFocusCandidates<T> {
  /** The closed country's row in the list (absent if it is unmarked or was removed). */
  row?: T | null
  /** What had focus when the panel opened, e.g. the search box. */
  opener?: T | null
  /** Last resorts, in order, e.g. the list's heading. */
  fallbacks?: (T | null | undefined)[]
}

/**
 * Where focus goes when the panel closes, or `null` to leave it be. Only
 * when focus was lost: if it is somewhere the user put it (the search, a
 * map control) or still inside the sidebar, it stays. Then the country's
 * row, else whatever opened the panel, else the fallbacks; the first that
 * is `usable` (still in the page, visible, not inert) wins.
 */
export function returnFocusTarget<T>(state: FocusState, candidates: ReturnFocusCandidates<T>, usable: (el: T) => boolean): T | null {
  if (state !== 'lost') return null
  const { row, opener, fallbacks = [] } = candidates
  for (const el of [row, opener, ...fallbacks]) {
    if (el && usable(el)) return el
  }
  return null
}
