import type {
  CountryIdentity,
  CreateCountryParseResult,
  UpdateCountryInput,
} from '../types/countriesApi'
import type { VisitedCountry } from '../types/country'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
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
    visitDate: typeof body.visitedAt === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.visitedAt)
      ? `${body.visitedAt}-01`
      : null,
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
