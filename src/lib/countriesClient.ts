import type { AddCountryInput, CountryIdentity, CountryVisit, VisitedCountry } from '../types'
import { parseCountryDto, parseVisitDto } from './countryWire'
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
