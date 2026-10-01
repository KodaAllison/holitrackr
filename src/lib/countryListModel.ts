import type { VisitedCountry } from '../types'
import { getContinent } from './continents'
import { formatVisitMonth } from './visitDate'

/** How the sidebar list is ordered. */
export type ListSort = 'continent' | 'date' | 'name'

export const LIST_SORTS: { value: ListSort; label: string }[] = [
  { value: 'continent', label: 'Continent' },
  { value: 'date', label: 'Date' },
  { value: 'name', label: 'Name' },
]

/** A run of rows under an optional heading (no heading when not grouped). */
export interface ListGroup {
  heading: string | null
  countries: VisitedCountry[]
}

const byName = (a: VisitedCountry, b: VisitedCountry) => a.name.localeCompare(b.name)

/** Newest first; undated countries last, by name. */
function byDate(a: VisitedCountry, b: VisitedCountry): number {
  const ad = formatVisitMonth(a.visitedAt) ? (a.visitedAt ?? '') : ''
  const bd = formatVisitMonth(b.visitedAt) ? (b.visitedAt ?? '') : ''
  if (ad !== bd) {
    if (!ad) return 1
    if (!bd) return -1
    return bd.localeCompare(ad)
  }
  return byName(a, b)
}

/**
 * The list's rows for a sort: by continent (largest group first, names A-Z
 * within), or one flat group by date or by name.
 */
export function groupCountries(countries: VisitedCountry[], sort: ListSort): ListGroup[] {
  if (countries.length === 0) return []
  if (sort === 'name') return [{ heading: null, countries: [...countries].sort(byName) }]
  if (sort === 'date') return [{ heading: null, countries: [...countries].sort(byDate) }]

  const groups = new Map<string, VisitedCountry[]>()
  for (const country of countries) {
    const continent = getContinent(country.code, country.name)
    groups.set(continent, [...(groups.get(continent) ?? []), country])
  }
  return [...groups.entries()]
    .sort(([a, al], [b, bl]) => bl.length - al.length || a.localeCompare(b))
    .map(([heading, list]) => ({ heading, countries: [...list].sort(byName) }))
}

/** The pieces of a row's sub-line; `stars` is rendered in its own colour. */
export interface RowSubline {
  text: string
  stars?: string
  tags?: string
}

/**
 * A row's sub-line, e.g. "Jun 2023 · ★★★★ · Food, History". An undated
 * visited country nudges for a date; a bucket-list country shows its hoped-for month.
 */
export function rowSubline(country: VisitedCountry): RowSubline {
  const when = formatVisitMonth(country.visitedAt)
  if (country.status === 'bucketlist') return { text: when ? `Hoping to go · ${when}` : 'Add when you hope to go' }
  if (!when) return { text: 'Add a visit date' }
  const rating = country.rating && country.rating >= 1 && country.rating <= 5 ? '★'.repeat(country.rating) : undefined
  const tags = country.tags && country.tags.length > 0 ? country.tags.join(', ') : undefined
  return { text: when, stars: rating, tags }
}
