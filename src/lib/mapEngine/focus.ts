import { countryKey } from '../visitedCountries'
import type { MapFocus } from './mapView'

/**
 * What a view does with a focus that was already set when it opened (e.g.
 * picked on the globe before switching to flat): apply it again ('always',
 * the globe), or only while its country is still selected ('selected').
 */
export type FocusReapply = 'always' | 'selected'

export interface FocusInput {
  focus: MapFocus | null | undefined
  /** The focus `seq` the view opened with. */
  openingSeq: number | undefined
  selectedKey: string | null
  /** The view can move and the countries have loaded. */
  ready: boolean
  reapply: FocusReapply
}

/** The focus a view should act on now, or null to hold or ignore it. */
export function focusAction({ focus, openingSeq, selectedKey, ready, reapply }: FocusInput): MapFocus | null {
  if (!focus || !ready) return null
  const fresh = focus.seq !== openingSeq
  if (fresh || reapply === 'always') return focus
  return countryKey(focus.country) === selectedKey ? focus : null
}
