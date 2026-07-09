import type { VisitedCountry } from '../types'

/**
 * Country identity and status lookups over a `VisitedCountry[]`.
 *
 * A country's identity is the composite `(code, name)` — codes can collide in
 * the GeoJSON data (see `src/types/country.ts`), so the name is part of the key.
 * These pure helpers are the single source of truth for that rule; every call
 * site should route through them rather than re-typing the comparison.
 */

/** The minimal identity shape shared by `Country` and `VisitedCountry`. */
export interface CountryIdentity {
  code: string
  name: string
}

type Status = VisitedCountry['status']

/** Composite-key equality — the single source of truth for country identity. */
export function sameCountry(a: CountryIdentity, b: CountryIdentity): boolean {
  return a.code === b.code && a.name === b.name
}

/** Stable React key derived from the composite identity. */
export function countryKey(c: CountryIdentity): string {
  return `${c.code}-${c.name}`
}

/** The matching entry in `list`, or `undefined` if the country is absent. */
export function findCountry(
  list: VisitedCountry[],
  c: CountryIdentity
): VisitedCountry | undefined {
  return list.find(v => sameCountry(v, c))
}

/** Whether `c` is present in `list`. */
export function hasCountry(list: VisitedCountry[], c: CountryIdentity): boolean {
  return findCountry(list, c) !== undefined
}

/** The status of `c` in `list`, or `undefined` if absent. */
export function statusOf(
  list: VisitedCountry[],
  c: CountryIdentity
): Status | undefined {
  return findCountry(list, c)?.status
}

/** Entries in `list` with the given status. */
export function withStatus(
  list: VisitedCountry[],
  status: Status
): VisitedCountry[] {
  return list.filter(v => v.status === status)
}
