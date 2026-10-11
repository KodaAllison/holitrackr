import type { VisitedCountry } from '../../types'
import type { CountryIdentity } from '../visitedCountries'
import { useMediaQuery } from '../useMediaQuery'
import type { IndexedCountry } from './countryIndex'

/** What both interactive map views (globe and flat) take from `WorldMap`. */
export interface MapViewOptions {
  countries: IndexedCountry[] | null
  statusOf: (country: IndexedCountry) => VisitedCountry['status'] | undefined
  hoveredKey: string | null
  selectedKey: string | null
  onHover: (country: IndexedCountry | null, x: number, y: number) => void
  onPick: (country: IndexedCountry, x: number, y: number) => void
  onMoveStart: () => void
  /** Zoom back out to the whole world whenever this changes ("World view"). */
  worldViewSeq?: number
  /** Bring this country into view whenever `seq` changes (e.g. picked in search). */
  focus?: MapFocus | null
  /**
   * Called after every frame with the selected country's anchor in screen
   * px, or null when nothing is selected or it can't be seen (for the name
   * label, which follows the map without a React render per frame).
   */
  onSelectedAnchor?: (point: [number, number] | null) => void
}

/** A request to show a country; with `pulse`, a ring pulses on it once the view lands (milestones). */
export interface MapFocus {
  country: CountryIdentity
  seq: number
  pulse?: boolean
}

/** The one place the map engine (and `WorldMap`) asks for reduced motion. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** Whether the user prefers reduced motion; updates when it changes. */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY)
}
