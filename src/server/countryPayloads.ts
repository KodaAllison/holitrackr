import type {
  CreateCountryParseResult,
  StoredCountryRow,
  UpdateCountryInput,
  VisitedCountryDto,
} from '../types/countriesApi.js'
import type { VisitedCountry } from '../types/country.js'
import { fromStoredVisitDate, toStoredVisitDate } from '../lib/visitDate.js'
import {
  asRecord,
  isRating,
  parseCountryIdentity,
  parseRating,
  parseTagList,
} from '../lib/countryWire.js'

/** Longest place text we store; longer input is cut, not rejected. */
export const MAX_PLACE_LENGTH = 120

export function parsePlace(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const place = value.trim().slice(0, MAX_PLACE_LENGTH)
  return place === '' ? null : place
}

/** Tags as the stored JSON array text (strings only), or null if not an array. */
export function parseTags(value: unknown): string | null {
  const tags = parseTagList(value)
  return tags ? JSON.stringify(tags) : null
}

export function parseCreateCountryInput(value: unknown): CreateCountryParseResult {
  const body = asRecord(value)
  const identity = parseCountryIdentity(body)
  if (!body || !identity) return { success: false, error: 'Invalid payload' }

  const status = body.status ?? 'visited'
  if (status !== 'visited' && status !== 'bucketlist') {
    return { success: false, error: 'Invalid status' }
  }

  return {
    success: true,
    value: {
      ...identity,
      status,
      notes: typeof body.notes === 'string' ? body.notes : null,
    },
  }
}

export function parseUpdateCountryInput(value: unknown): UpdateCountryInput | undefined {
  const body = asRecord(value)
  const identity = parseCountryIdentity(body)
  if (!body || !identity) return undefined

  return {
    ...identity,
    notes: typeof body.notes === 'string' ? body.notes : null,
    place: parsePlace(body.place),
    visitDate: toStoredVisitDate(body.visitedAt),
    rating: parseRating(body.rating),
    tags: parseTags(body.tags),
  }
}

export function parseStoredStatus(value: unknown): VisitedCountry['status'] {
  return value === 'bucketlist' ? 'bucketlist' : 'visited'
}

export function parseStoredTags(value: string | null): string[] | undefined {
  if (!value) return undefined

  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string')
      : undefined
  } catch {
    return undefined
  }
}

/**
 * A stored rating on the wire. The CHECK constraint was added NOT VALID, so a
 * legacy row may hold a value outside 1-5; serialise it as no rating rather
 * than send something the client would reject along with the whole list.
 */
export function storedRating(rating: number | null): number | undefined {
  return isRating(rating) ? rating : undefined
}

export function serializeStoredCountry(
  row: StoredCountryRow
): VisitedCountryDto {
  return {
    code: row.country_code,
    name: row.country_name,
    status: parseStoredStatus(row.status),
    notes: row.notes ?? undefined,
    place: row.place ?? undefined,
    visitedAt: fromStoredVisitDate(row.visit_date),
    rating: storedRating(row.rating),
    tags: parseStoredTags(row.tags),
  }
}
