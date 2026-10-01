import type { CountryVisit, VisitedCountry } from '../types'
import type { JournalValues } from './journal'
import { sameCountry, type CountryIdentity } from './visitedCountries'

/**
 * Extra visits (FEATURES.md #8) as pure list updates, for the optimistic
 * state in App.tsx and the in-memory countries client. A country's own
 * journal fields are its first visit; `visits` holds the rest, oldest first.
 */

/** A visit as the API stores and returns it (blank place dropped). */
export function toVisit(id: number, values: JournalValues): CountryVisit {
  return {
    id,
    visitedAt: values.visitedAt,
    place: values.place.trim() || undefined,
    rating: values.rating,
    notes: values.notes,
    tags: [...values.tags],
  }
}

/** Oldest first, then by id: the order the API returns. */
export function sortVisits(visits: CountryVisit[]): CountryVisit[] {
  return [...visits].sort((a, b) => a.visitedAt.localeCompare(b.visitedAt) || a.id - b.id)
}

/** The journal form's values for an extra visit. */
export function visitValuesOf(visit: CountryVisit): JournalValues {
  return {
    notes: visit.notes ?? '',
    place: visit.place ?? '',
    visitedAt: visit.visitedAt,
    rating: visit.rating,
    tags: visit.tags ?? [],
  }
}

function mapVisits(
  list: VisitedCountry[],
  change: (visits: CountryVisit[], country: VisitedCountry) => CountryVisit[]
): VisitedCountry[] {
  return list.map(country => {
    const before = country.visits ?? []
    const after = change(before, country)
    if (after === before) return country
    if (after.length > 0) return { ...country, visits: sortVisits(after) }
    const rest = { ...country }
    delete rest.visits
    return rest
  })
}

export function withVisitAdded(list: VisitedCountry[], country: CountryIdentity, visit: CountryVisit): VisitedCountry[] {
  return mapVisits(list, (visits, candidate) => (sameCountry(candidate, country) ? [...visits, visit] : visits))
}

/** Replace the visit with `id` (e.g. a pending one with the stored one). */
export function withVisitReplaced(list: VisitedCountry[], id: number, visit: CountryVisit): VisitedCountry[] {
  return mapVisits(list, visits =>
    visits.some(v => v.id === id) ? visits.map(v => (v.id === id ? visit : v)) : visits
  )
}

export function withVisitRemoved(list: VisitedCountry[], id: number): VisitedCountry[] {
  return mapVisits(list, visits => (visits.some(v => v.id === id) ? visits.filter(v => v.id !== id) : visits))
}

/** Whether `id` is a placeholder for a visit still being saved. */
export function isPendingVisit(id: number): boolean {
  return id < 0
}
