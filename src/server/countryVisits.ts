import type { QueryResultRow } from 'pg'
import type {
  CountryIdentity,
  CountryVisitDto,
  CountryVisitRow,
  CreateVisitInput,
  StoredCountryRow,
  UpdateVisitInput,
  VisitedCountryDto,
} from '../types/countriesApi.js'
import { fromStoredVisitDate, toStoredVisitDate } from '../lib/visitDate.js'
import {
  asRecord,
  parseCountryIdentity,
  parsePlace,
  parseRating,
  parseStoredTags,
  parseTags,
  serializeStoredCountry,
} from './countryPayloads.js'

/**
 * Multiple visits per country (FEATURES.md #8).
 *
 * `visited_countries` stays the status record and its journal columns stay the
 * country's first (primary) visit. Extra visits live in `country_visits`. No
 * rows are copied between the tables: the API returns the primary visit in the
 * country's own fields and the extra visits in `visits`, so existing data needs
 * no backfill. Shared by the Express server and the Vercel functions.
 */

/** The database seam: `pg` and Neon pools both fit it. */
export interface CountriesDatabase {
  query<Row extends QueryResultRow>(statement: string, parameters: unknown[]): Promise<{ rows: Row[] }>
}

// visit_date::text keeps the value as `YYYY-MM-DD` text: pg drivers would
// otherwise return a JS Date, and ::text (unlike to_char) also works if a
// deployment's column was ever created as TEXT.
const LIST_COUNTRIES_SQL = `SELECT country_code, country_name, status, notes, place,
       visit_date::text AS visit_date, rating, tags
FROM visited_countries
WHERE user_id = $1
ORDER BY visited_countries.visit_date DESC NULLS LAST, created_at DESC`

const VISIT_COLUMNS = `id, country_code, country_name, visit_date::text AS visit_date,
       place, rating, notes, tags`

const LIST_VISITS_SQL = `SELECT ${VISIT_COLUMNS}
FROM country_visits
WHERE user_id = $1
ORDER BY country_visits.visit_date ASC, id ASC`

// Only for a country the user already has; otherwise no row is inserted.
// Casts: in INSERT ... SELECT, untyped parameters would otherwise resolve to text.
const INSERT_VISIT_SQL = `INSERT INTO country_visits
  (user_id, country_code, country_name, visit_date, place, rating, notes, tags)
SELECT $1::text, $2::text, $3::text, $4::date, $5::text, $6::integer, $7::text, $8::text
WHERE EXISTS (
  SELECT 1 FROM visited_countries
  WHERE user_id = $1 AND country_code = $2 AND country_name = $3
)
RETURNING ${VISIT_COLUMNS}`

const UPDATE_VISIT_SQL = `UPDATE country_visits
SET visit_date = $1, place = $2, rating = $3, notes = $4, tags = $5
WHERE id = $6 AND user_id = $7
RETURNING id`

const DELETE_VISIT_SQL = `DELETE FROM country_visits WHERE id = $1 AND user_id = $2`

// One statement each, so a country and its visits go together or not at all.
const DELETE_COUNTRY_SQL = `WITH removed_visits AS (
  DELETE FROM country_visits
  WHERE user_id = $1 AND country_code = $2 AND country_name = $3
)
DELETE FROM visited_countries
WHERE user_id = $1 AND country_code = $2 AND country_name = $3`

const RESET_COUNTRIES_SQL = `WITH removed_visits AS (
  DELETE FROM country_visits WHERE user_id = $1
)
DELETE FROM visited_countries WHERE user_id = $1`

export function parseVisitId(value: unknown): number | undefined {
  const id = asRecord(value)?.id
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : undefined
}

export function parseCreateVisitInput(value: unknown): CreateVisitInput | undefined {
  const body = asRecord(value)
  const identity = parseCountryIdentity(body)
  const visitDate = toStoredVisitDate(body?.visitedAt)
  if (!body || !identity || !visitDate) return undefined
  return {
    ...identity,
    visitDate,
    place: parsePlace(body.place),
    rating: parseRating(body.rating),
    notes: typeof body.notes === 'string' ? body.notes : null,
    tags: parseTags(body.tags),
  }
}

export function parseUpdateVisitInput(value: unknown): UpdateVisitInput | undefined {
  const body = asRecord(value)
  const id = parseVisitId(body)
  const visitDate = toStoredVisitDate(body?.visitedAt)
  if (!body || id === undefined || !visitDate) return undefined
  return {
    id,
    visitDate,
    place: parsePlace(body.place),
    rating: parseRating(body.rating),
    notes: typeof body.notes === 'string' ? body.notes : null,
    tags: parseTags(body.tags),
  }
}

export function serializeVisitRow(row: CountryVisitRow): CountryVisitDto {
  return {
    id: row.id,
    visitedAt: fromStoredVisitDate(row.visit_date) ?? '',
    place: row.place ?? undefined,
    rating: row.rating ?? undefined,
    notes: row.notes ?? undefined,
    tags: parseStoredTags(row.tags),
  }
}

const identityKey = (code: string, name: string) => JSON.stringify([code, name])

/**
 * Join the countries with their extra visits (one query each, merged here).
 * `visits` is set only on countries that have some; order follows `visitRows`.
 */
export function mergeCountryVisits(
  countryRows: StoredCountryRow[],
  visitRows: CountryVisitRow[]
): VisitedCountryDto[] {
  const byCountry = new Map<string, CountryVisitDto[]>()
  for (const row of visitRows) {
    const key = identityKey(row.country_code, row.country_name)
    const list = byCountry.get(key) ?? []
    list.push(serializeVisitRow(row))
    byCountry.set(key, list)
  }
  return countryRows.map(row => {
    const country = serializeStoredCountry(row)
    const visits = byCountry.get(identityKey(row.country_code, row.country_name))
    return visits ? { ...country, visits } : country
  })
}

export async function listCountries(database: CountriesDatabase, userId: string): Promise<VisitedCountryDto[]> {
  const [countries, visits] = await Promise.all([
    database.query<StoredCountryRow>(LIST_COUNTRIES_SQL, [userId]),
    database.query<CountryVisitRow>(LIST_VISITS_SQL, [userId]),
  ])
  return mergeCountryVisits(countries.rows, visits.rows)
}

/** Remove one country from the user's atlas, with its extra visits. */
export async function deleteCountry(
  database: CountriesDatabase,
  userId: string,
  identity: CountryIdentity
): Promise<void> {
  await database.query(DELETE_COUNTRY_SQL, [userId, identity.code, identity.name])
}

/** Remove every country (and visit) the user has. */
export async function resetCountries(database: CountriesDatabase, userId: string): Promise<void> {
  await database.query(RESET_COUNTRIES_SQL, [userId])
}

export interface VisitsRequest {
  method: string
  /** The session user; undefined means signed out. */
  userId: string | undefined
  body: unknown
  database: CountriesDatabase
}

export interface VisitsHttpResponse {
  status: number
  body?: CountryVisitDto | { error: string }
}

const INVALID = { status: 400, body: { error: 'Invalid payload' } }

/** POST / PATCH / DELETE /api/countries/visits, always scoped to the session user. */
export async function handleCountryVisitsRequest(request: VisitsRequest): Promise<VisitsHttpResponse> {
  const { userId, database } = request
  if (!userId) return { status: 401, body: { error: 'Unauthorized' } }
  const method = request.method.toUpperCase()

  if (method === 'POST') {
    const input = parseCreateVisitInput(request.body)
    if (!input) return INVALID
    const { rows } = await database.query<CountryVisitRow>(INSERT_VISIT_SQL, [
      userId, input.code, input.name, input.visitDate, input.place, input.rating, input.notes, input.tags,
    ])
    return rows[0]
      ? { status: 201, body: serializeVisitRow(rows[0]) }
      : { status: 404, body: { error: 'Country not found' } }
  }

  if (method === 'PATCH') {
    const input = parseUpdateVisitInput(request.body)
    if (!input) return INVALID
    const { rows } = await database.query<{ id: number }>(UPDATE_VISIT_SQL, [
      input.visitDate, input.place, input.rating, input.notes, input.tags, input.id, userId,
    ])
    return rows.length > 0 ? { status: 204 } : { status: 404, body: { error: 'Visit not found' } }
  }

  if (method === 'DELETE') {
    const id = parseVisitId(request.body)
    if (id === undefined) return INVALID
    await database.query(DELETE_VISIT_SQL, [id, userId])
    return { status: 204 }
  }

  return { status: 405, body: { error: 'Method not allowed' } }
}
