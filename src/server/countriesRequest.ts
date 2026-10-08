import type { VisitedCountryDto } from '../types/countriesApi.js'
import { parseCountryIdentity, parseCreateCountryInput, parseUpdateCountryInput } from './countryPayloads.js'
import { deleteCountry, listCountries, resetCountries, type CountriesDatabase } from './countryVisits.js'

const UPSERT_COUNTRY_SQL = `INSERT INTO visited_countries (user_id, country_code, country_name, status, notes)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, country_code, country_name) DO UPDATE
  SET status = EXCLUDED.status,
      notes = COALESCE(EXCLUDED.notes, visited_countries.notes)`

const UPDATE_JOURNAL_SQL = `UPDATE visited_countries SET notes = $1, place = $2, visit_date = $3, rating = $4, tags = $5
WHERE user_id = $6 AND country_code = $7 AND country_name = $8`

export interface CountriesRequest {
  method: string
  /** The session user; undefined means signed out. */
  userId: string | undefined
  body: unknown
  /** `?reset=true` on DELETE: remove every country. */
  reset: boolean
  database: CountriesDatabase
}

export interface CountriesHttpResponse {
  status: number
  body?: VisitedCountryDto[] | { error: string }
}

const INVALID = { status: 400, body: { error: 'Invalid payload' } }

/**
 * GET / POST / PATCH / DELETE /api/countries, always scoped to the session user.
 * Shared by the Express server and the Vercel function, like the visits handler.
 */
export async function handleCountriesRequest(request: CountriesRequest): Promise<CountriesHttpResponse> {
  const { userId, database } = request
  if (!userId) return { status: 401, body: { error: 'Unauthorized' } }
  const method = request.method.toUpperCase()

  if (method === 'GET') {
    return { status: 200, body: await listCountries(database, userId) }
  }

  if (method === 'POST') {
    const parsed = parseCreateCountryInput(request.body)
    if (!parsed.success) return { status: 400, body: { error: parsed.error } }
    const { code, name, status, notes } = parsed.value
    await database.query(UPSERT_COUNTRY_SQL, [userId, code, name, status, notes])
    return { status: 204 }
  }

  if (method === 'PATCH') {
    const input = parseUpdateCountryInput(request.body)
    if (!input) return INVALID
    await database.query(UPDATE_JOURNAL_SQL, [
      input.notes, input.place, input.visitDate, input.rating, input.tags, userId, input.code, input.name,
    ])
    return { status: 204 }
  }

  if (method === 'DELETE') {
    if (request.reset) {
      await resetCountries(database, userId)
      return { status: 204 }
    }
    const identity = parseCountryIdentity(request.body)
    if (!identity) return INVALID
    await deleteCountry(database, userId, identity)
    return { status: 204 }
  }

  return { status: 405, body: { error: 'Method not allowed' } }
}
