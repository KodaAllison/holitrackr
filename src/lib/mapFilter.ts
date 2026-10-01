import type { MapFilter, VisitedCountry } from '../types'

type Status = VisitedCountry['status']

/** Both kinds of marked country shown: the map's starting filter. */
export const SHOW_ALL: MapFilter = { visited: true, bucketlist: true }

/** The status the map should draw: none when that status is filtered out. */
export function shownStatus(status: Status | undefined, filter: MapFilter): Status | undefined {
  return status && filter[status] ? status : undefined
}

/** The filter with one status shown or hidden. */
export function withShown(filter: MapFilter, status: Status, shown: boolean): MapFilter {
  return { ...filter, [status]: shown }
}

/** The undo toast's text after a country is marked. */
export function markedMessage(name: string, status: Status): string {
  return status === 'visited' ? `${name} marked as visited` : `${name} added to your bucket list`
}
