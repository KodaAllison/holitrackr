import type { CountryIdentity, CountryVisit, VisitedCountry } from '../types/country.js'
import { isVisitMonth } from './visitDate.js'

/**
 * The Country wire format, in one place.
 *
 * The rules for what a rating, tag list, country identity and visit month may
 * be on the API. The server uses them to read request bodies and to serialise
 * rows; the client uses them to validate responses. No browser or server
 * dependencies, so both sides can import it.
 *
 * Rating rule: a whole number from 1 to 5. That is exactly what the database
 * stores (`INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)`) and what
 * the star picker produces, so nothing this accepts can be rejected or silently
 * altered by the database. Anything else (0, 6, 4.6, NaN, a string) is not a
 * rating.
 */

export const MIN_RATING = 1
export const MAX_RATING = 5

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** A whole number from 1 to 5. */
export function isRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) &&
    value >= MIN_RATING && value <= MAX_RATING
}

/** An array of strings. */
export function isTags(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((tag) => typeof tag === 'string')
}

/** A rating, or `null` for anything that is not one (the request-side rule). */
export function parseRating(value: unknown): number | null {
  return isRating(value) ? value : null
}

/** The strings in an array, or `null` if `value` is not an array (the request-side rule). */
export function parseTagList(value: unknown): string[] | null {
  return Array.isArray(value)
    ? value.filter((tag): tag is string => typeof tag === 'string')
    : null
}

export function isCountryIdentity(value: unknown): value is CountryIdentity {
  const record = asRecord(value)
  return record !== undefined && typeof record.code === 'string' && typeof record.name === 'string'
}

export function parseCountryIdentity(value: unknown): CountryIdentity | undefined {
  const record = asRecord(value)
  return record && isCountryIdentity(record) ? { code: record.code, name: record.name } : undefined
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

/** An extra visit as the API returns it, or `undefined` if it is malformed. */
export function parseVisitDto(value: unknown): CountryVisit | undefined {
  const visit = asRecord(value)
  if (
    !visit ||
    typeof visit.id !== 'number' ||
    !Number.isInteger(visit.id) ||
    !isVisitMonth(visit.visitedAt) ||
    !isOptionalString(visit.place) ||
    !isOptionalString(visit.notes) ||
    !(visit.rating === undefined || isRating(visit.rating)) ||
    !(visit.tags === undefined || isTags(visit.tags))
  ) {
    return undefined
  }
  return {
    id: visit.id,
    visitedAt: visit.visitedAt,
    place: visit.place,
    rating: visit.rating,
    notes: visit.notes,
    tags: visit.tags,
  }
}

function parseVisitsDto(value: unknown): CountryVisit[] | undefined | null {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return null
  const visits = value.map(parseVisitDto)
  return visits.every((visit): visit is CountryVisit => visit !== undefined) ? visits : null
}

/** A country as the API returns it, or `undefined` if it is malformed. */
export function parseCountryDto(value: unknown): VisitedCountry | undefined {
  const country = asRecord(value)
  if (!country || !isCountryIdentity(country)) return undefined

  const visits = parseVisitsDto(country.visits)
  if (
    visits === null ||
    (country.status !== 'visited' && country.status !== 'bucketlist') ||
    !isOptionalString(country.notes) ||
    !isOptionalString(country.place) ||
    !(country.visitedAt === undefined || isVisitMonth(country.visitedAt)) ||
    !(country.rating === undefined || isRating(country.rating)) ||
    !(country.tags === undefined || isTags(country.tags))
  ) {
    return undefined
  }

  return {
    code: country.code,
    name: country.name,
    status: country.status,
    notes: country.notes,
    place: country.place,
    visitedAt: country.visitedAt,
    rating: country.rating,
    tags: country.tags,
    ...(visits ? { visits } : {}),
  }
}
