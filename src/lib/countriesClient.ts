import type {
  AddCountryInput,
  CountryIdentity,
  VisitedCountryDto,
} from '../types/countriesApi'
import type { CountryVisit, VisitedCountry } from '../types/country'
import { sameCountry } from './visitedCountries'
import { isVisitMonth } from './visitDate'
import { sortVisits, toVisit } from './countryVisits'

export interface CountryJournalUpdates {
  notes: string
  place: string
  visitedAt: string
  rating: number | undefined
  tags: string[]
}

export interface CountriesClient {
  list(): Promise<VisitedCountry[]>
  add(country: AddCountryInput): Promise<void>
  remove(country: CountryIdentity): Promise<void>
  updateJournal(
    country: CountryIdentity,
    updates: CountryJournalUpdates
  ): Promise<void>
  reset(): Promise<void>
  /** Add an extra visit (its `visitedAt` is required); resolves to the stored visit. */
  addVisit(country: CountryIdentity, values: CountryJournalUpdates): Promise<CountryVisit>
  updateVisit(id: number, values: CountryJournalUpdates): Promise<void>
  removeVisit(id: number): Promise<void>
}

const VISITS_PATH = '/api/countries/visits'

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

function cloneVisit(visit: CountryVisit): CountryVisit {
  return { ...visit, tags: visit.tags ? [...visit.tags] : undefined }
}

function cloneCountry(country: VisitedCountry): VisitedCountry {
  return {
    ...country,
    tags: country.tags ? [...country.tags] : undefined,
    visits: country.visits?.map(cloneVisit),
  }
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

function isOptionalRating(value: unknown): value is number | undefined {
  return value === undefined ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 5)
}

function isOptionalTags(value: unknown): value is string[] | undefined {
  return value === undefined ||
    (Array.isArray(value) && value.every((tag) => typeof tag === 'string'))
}

function parseVisitDto(value: unknown): CountryVisit | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  const visit = value as Record<string, unknown>
  if (
    typeof visit.id !== 'number' ||
    !Number.isInteger(visit.id) ||
    !isVisitMonth(visit.visitedAt) ||
    !isOptionalString(visit.place) ||
    !isOptionalString(visit.notes) ||
    !isOptionalRating(visit.rating) ||
    !isOptionalTags(visit.tags)
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

/** The journal as the API takes it: blanks become null. */
function journalBody(values: CountryJournalUpdates) {
  return {
    notes: values.notes,
    place: values.place.trim() || null,
    visitedAt: values.visitedAt || null,
    rating: values.rating ?? null,
    tags: values.tags,
  }
}

function parseCountryDto(value: unknown): VisitedCountryDto | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }

  const country = value as Record<string, unknown>
  const visits = parseVisitsDto(country.visits)
  if (
    visits === null ||
    typeof country.code !== 'string' ||
    typeof country.name !== 'string' ||
    (country.status !== 'visited' && country.status !== 'bucketlist') ||
    !isOptionalString(country.notes) ||
    !isOptionalString(country.place) ||
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
    place: country.place,
    visitedAt: country.visitedAt,
    rating: country.rating,
    tags: country.tags,
    ...(visits ? { visits } : {}),
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
    body: unknown,
    path = '/api/countries'
  ): Promise<Response> => assertSuccessfulResponse(fetcher, path, {
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
      await jsonRequest('POST', {
        code: country.code,
        name: country.name,
        status: country.status,
        notes: country.notes,
      })
    },

    async remove(country) {
      await jsonRequest('DELETE', { code: country.code, name: country.name })
    },

    async updateJournal(country, updates) {
      await jsonRequest('PATCH', {
        code: country.code,
        name: country.name,
        ...journalBody(updates),
      })
    },

    async addVisit(country, values) {
      const response = await jsonRequest('POST', {
        code: country.code,
        name: country.name,
        ...journalBody(values),
      }, VISITS_PATH)
      let visit: CountryVisit | undefined
      try {
        visit = parseVisitDto(await response.json())
      } catch (error) {
        throw new CountriesClientError('Countries API returned an invalid response', response.status, error)
      }
      if (!visit) {
        throw new CountriesClientError('Countries API returned an invalid response', response.status)
      }
      return visit
    },

    async updateVisit(id, values) {
      await jsonRequest('PATCH', { id, ...journalBody(values) }, VISITS_PATH)
    },

    async removeVisit(id) {
      await jsonRequest('DELETE', { id }, VISITS_PATH)
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
  let nextVisitId = 1 + Math.max(0, ...countries.flatMap((c) => c.visits ?? []).map((v) => v.id))

  return {
    async list() {
      return countries.map(cloneCountry)
    },

    async add(country) {
      const index = countries.findIndex((candidate) => sameCountry(candidate, country))
      if (index === -1) {
        countries.push({
          code: country.code,
          name: country.name,
          status: country.status,
          notes: country.notes,
        })
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
        (candidate) => !sameCountry(candidate, country)
      )
    },

    async updateJournal(country, updates) {
      countries = countries.map((candidate) =>
        sameCountry(candidate, country)
          ? {
              ...candidate,
              notes: updates.notes,
              place: updates.place.trim() || undefined,
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

    async addVisit(country, values) {
      const existing = countries.find((candidate) => sameCountry(candidate, country))
      if (!existing) throw new CountriesClientError('Country not found', 404)
      if (!isVisitMonth(values.visitedAt)) throw new CountriesClientError('Invalid payload', 400)
      const visit = toVisit(nextVisitId++, values)
      existing.visits = sortVisits([...(existing.visits ?? []), visit])
      return cloneVisit(visit)
    },

    async updateVisit(id, values) {
      if (!isVisitMonth(values.visitedAt)) throw new CountriesClientError('Invalid payload', 400)
      const owner = countries.find((country) => country.visits?.some((visit) => visit.id === id))
      if (!owner?.visits) throw new CountriesClientError('Visit not found', 404)
      owner.visits = sortVisits(owner.visits.map((visit) =>
        visit.id === id ? toVisit(id, values) : visit
      ))
    },

    async removeVisit(id) {
      for (const country of countries) {
        if (!country.visits) continue
        country.visits = country.visits.filter((visit) => visit.id !== id)
        if (country.visits.length === 0) delete country.visits
      }
    },
  }
}

export const httpCountriesClient = createHttpCountriesClient()
