import type { VisitedCountry } from '../types'
import type { CountryJournalUpdates } from './countriesClient'

export const PRESET_TAGS = ['Food', 'Culture', 'Nature', 'Adventure', 'Work', 'Beach', 'City', 'Wildlife', 'History']

/** The journal's editable values, as a form holds them. */
export type JournalValues = CountryJournalUpdates

export function journalValuesOf(country: VisitedCountry): JournalValues {
  return {
    notes: country.notes ?? '',
    place: country.place ?? '',
    visitedAt: country.visitedAt ?? '',
    rating: country.rating,
    tags: country.tags ?? [],
  }
}
