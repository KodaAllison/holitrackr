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

/** What the server must do to match a status transition. */
export type StatusAction =
  | { type: 'upsert'; status: Status }
  | { type: 'remove' }

export interface StatusTransition {
  next: VisitedCountry[]
  action: StatusAction
}

/**
 * The status-cycle rule for a country, as a pure function of the current list.
 *
 * - No `explicitStatus` (map click): absent → visited → bucketlist → removed.
 * - With `explicitStatus` (search or map menu): selecting the country's current
 *   status removes it; otherwise it is added or switched to that status.
 *
 * Switching status updates the entry in place so its journal fields survive.
 */
export function nextVisitedState(
  prev: VisitedCountry[],
  country: CountryIdentity,
  explicitStatus?: Status
): StatusTransition {
  const current = statusOf(prev, country)

  let target: Status | undefined
  if (explicitStatus !== undefined) {
    target = current === explicitStatus ? undefined : explicitStatus
  } else if (current === undefined) {
    target = 'visited'
  } else if (current === 'visited') {
    target = 'bucketlist'
  }

  if (target === undefined) {
    return {
      next: prev.filter(v => !sameCountry(v, country)),
      action: { type: 'remove' },
    }
  }

  const status = target
  const next =
    current === undefined
      ? [...prev, { code: country.code, name: country.name, status }]
      : prev.map(v => (sameCountry(v, country) ? { ...v, status } : v))
  return { next, action: { type: 'upsert', status } }
}

/**
 * Apply a planned `action` to `list`. Unlike `nextVisitedState` this is
 * idempotent: an upsert sets the status (keeping the entry's journal and
 * visits) or appends the country; a remove filters it out. Safe to run on a
 * list that differs from the one the action was planned from, and to replay.
 */
export function withStatusAction(
  list: VisitedCountry[],
  country: CountryIdentity,
  action: StatusAction
): VisitedCountry[] {
  if (action.type === 'remove') return list.filter(v => !sameCountry(v, country))
  const { status } = action
  return hasCountry(list, country)
    ? list.map(v => (sameCountry(v, country) ? { ...v, status } : v))
    : [...list, { code: country.code, name: country.name, status }]
}
