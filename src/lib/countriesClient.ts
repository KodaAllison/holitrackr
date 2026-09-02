import type { VisitedCountryDto, CountryIdentity } from '../types/countriesApi'
import type { VisitedCountry } from '../types/country'

export interface CountryJournalUpdates {
  notes: string
  visitedAt: string
  rating: number | undefined
  tags: string[]
}

export interface CountriesClient {
  list(): Promise<VisitedCountry[]>
  add(country: VisitedCountry): Promise<void>
  remove(country: CountryIdentity): Promise<void>
  updateJournal(
    country: CountryIdentity,
    updates: CountryJournalUpdates
  ): Promise<void>
  reset(): Promise<void>
}

export class CountriesClientError extends Error {
  readonly status?: number
  readonly cause?: unknown

  constructor(message: string, status?: number, cause?: unknown) {
    super(message)
    this.name = 'CountriesClientError'
    this.status = status
    this.cause = cause
  }
}

function cloneCountry(country: VisitedCountry): VisitedCountry {
  return {
    ...country,
    tags: country.tags ? [...country.tags] : undefined,
  }
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

function parseCountryDto(value: unknown): VisitedCountryDto | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }

  const country = value as Record<string, unknown>
  if (
    typeof country.code !== 'string' ||
    typeof country.name !== 'string' ||
    (country.status !== 'visited' && country.status !== 'bucketlist') ||
    !isOptionalString(country.notes) ||
    !isOptionalString(country.visitedAt) ||
    (country.rating !== undefined &&
      (typeof country.rating !== 'number' ||
        !Number.isFinite(country.rating) ||
        country.rating < 1 ||
        country.rating > 5)) ||
    (country.tags !== undefined &&
      (!Array.isArray(country.tags) ||
        !country.tags.every((tag) => typeof tag === 'string')))
  ) {
    return undefined
  }

  return {
    code: country.code,
    name: country.name,
    status: country.status,
    notes: country.notes,
    visitedAt: country.visitedAt,
    rating: country.rating,
    tags: country.tags,
  }
}

async function assertSuccessfulResponse(
  fetcher: typeof fetch,
  path: string,
  init: RequestInit
): Promise<Response> {
  let response: Response
  try {
    response = await fetcher(path, init)
  } catch (error) {
    throw new CountriesClientError('Countries API request failed', undefined, error)
  }

  if (!response.ok) {
    throw new CountriesClientError(
      `Countries API request failed with HTTP ${response.status}`,
      response.status
    )
  }

  return response
}

export function createHttpCountriesClient(
  fetcher: typeof fetch = fetch
): CountriesClient {
  const jsonRequest = (
    method: 'POST' | 'PATCH' | 'DELETE',
    body: unknown
  ): Promise<Response> => assertSuccessfulResponse(fetcher, '/api/countries', {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return {
    async list() {
      const response = await assertSuccessfulResponse(fetcher, '/api/countries', {
        method: 'GET',
        credentials: 'include',
      })

      let body: unknown
      try {
        body = await response.json()
      } catch (error) {
        throw new CountriesClientError(
          'Countries API returned an invalid response',
          response.status,
          error
        )
      }

      if (!Array.isArray(body)) {
        throw new CountriesClientError(
          'Countries API returned an invalid response',
          response.status
        )
      }

      const countries = body.map(parseCountryDto)
      if (countries.some((country) => country === undefined)) {
        throw new CountriesClientError(
          'Countries API returned an invalid response',
          response.status
        )
      }

      return countries as VisitedCountry[]
    },

    async add(country) {
      await jsonRequest('POST', country)
    },

    async remove(country) {
      await jsonRequest('DELETE', { code: country.code, name: country.name })
    },

    async updateJournal(country, updates) {
      await jsonRequest('PATCH', {
        code: country.code,
        name: country.name,
        notes: updates.notes,
        visitedAt: updates.visitedAt || null,
        rating: updates.rating ?? null,
        tags: updates.tags,
      })
    },

    async reset() {
      await assertSuccessfulResponse(fetcher, '/api/countries?reset=true', {
        method: 'DELETE',
        credentials: 'include',
      })
    },
  }
}

export function createInMemoryCountriesClient(
  initialCountries: VisitedCountry[] = []
): CountriesClient {
  let countries = initialCountries.map(cloneCountry)

  return {
    async list() {
      return countries.map(cloneCountry)
    },

    async add(country) {
      const index = countries.findIndex(
        (candidate) =>
          candidate.code === country.code && candidate.name === country.name
      )
      if (index === -1) {
        countries.push(cloneCountry(country))
        return
      }

      const existing = countries[index]
      countries[index] = {
        ...existing,
        status: country.status,
        notes: country.notes ?? existing.notes,
      }
    },

    async remove(country) {
      countries = countries.filter(
        (candidate) =>
          candidate.code !== country.code || candidate.name !== country.name
      )
    },

    async updateJournal(country, updates) {
      countries = countries.map((candidate) =>
        candidate.code === country.code && candidate.name === country.name
          ? {
              ...candidate,
              notes: updates.notes,
              visitedAt: updates.visitedAt || undefined,
              rating: updates.rating,
              tags: [...updates.tags],
            }
          : candidate
      )
    },

    async reset() {
      countries = []
    },
  }
}

export const httpCountriesClient = createHttpCountriesClient()
