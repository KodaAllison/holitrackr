import type { VisitedCountry } from '../types'

type Status = VisitedCountry['status']

/**
 * The status to send when a search result's Visited / Bucket list button is
 * pressed, or `undefined` when the press should do nothing.
 *
 * The country's current status shows as the pressed button, so pressing it
 * again is a no-op (as in `StatusControl`). Passing it on would hit the
 * explicit-status rule in `nextVisitedState` (picking the current status
 * removes the country), which drops its journal and visits with no Undo.
 * Removing a country lives in the detail panel.
 */
export function searchStatusToMark(current: Status | undefined, picked: Status): Status | undefined {
  return current === picked ? undefined : picked
}
