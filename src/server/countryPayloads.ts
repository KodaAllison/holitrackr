import type {
  CountryIdentity,
  CreateCountryParseResult,
  StoredCountryRow,
  UpdateCountryInput,
  VisitedCountryDto,
} from '../types/countriesApi.js'
import type { VisitedCountry } from '../types/country.js'
import { fromStoredVisitDate, toStoredVisitDate } from '../lib/visitDate.js'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** Longest place text we store; longer input is cut, not rejected. */
export const MAX_PLACE_LENGTH = 120

function parsePlace(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const place = value.trim().slice(0, MAX_PLACE_LENGTH)
  return place === '' ? null : place
}

export function parseCountryIdentity(value: unknown): CountryIdentity | undefined {
  const body = asRecord(value)
  if (!body || typeof body.code !== 'string' || typeof body.name !== 'string') return undefined
  return { code: body.code, name: body.name }
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
    rating: typeof body.rating === 'number' && body.rating >= 1 && body.rating <= 5
      ? Math.round(body.rating)
      : null,
    tags: Array.isArray(body.tags)
      ? JSON.stringify(body.tags.filter((tag): tag is string => typeof tag === 'string'))
      : null,
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
    rating: row.rating ?? undefined,
    tags: parseStoredTags(row.tags),
  }
}
