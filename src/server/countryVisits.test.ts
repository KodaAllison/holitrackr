import { describe, expect, it } from 'vitest'
import type { CountryVisitRow, StoredCountryRow } from '../types/countriesApi'
import {
  deleteCountry,
  handleCountryVisitsRequest,
  listCountries,
  mergeCountryVisits,
  parseCreateVisitInput,
  parseUpdateVisitInput,
  parseVisitId,
  resetCountries,
  serializeVisitRow,
  type CountriesDatabase,
} from './countryVisits'

interface Call { statement: string; parameters: unknown[] }

/** A fake database: records every call and answers each with the next canned rows. */
function fakeDatabase(...answers: object[][]): { database: CountriesDatabase; calls: Call[] } {
  const calls: Call[] = []
  const database: CountriesDatabase = {
    query: async <Row,>(statement: string, parameters: unknown[]) => {
      calls.push({ statement, parameters })
      return { rows: (answers.shift() ?? []) as Row[] }
    },
  }
  return { database, calls }
}

const spain: StoredCountryRow = {
  country_code: 'ESP', country_name: 'Spain', status: 'visited',
  notes: 'First time', place: 'Madrid', visit_date: '2015-07-01', rating: 4, tags: '["City"]',
}
const japan: StoredCountryRow = {
  country_code: 'JPN', country_name: 'Japan', status: 'visited',
  notes: null, place: null, visit_date: null, rating: null, tags: null,
}
const visitRow = (id: number, date: string, name = 'Spain', code = 'ESP'): CountryVisitRow => ({
  id, country_code: code, country_name: name, visit_date: date,
  place: null, rating: null, notes: null, tags: null,
})

describe('visit payload parsing', () => {
  it('parses a new visit, normalising its journal like the country PATCH', () => {
    expect(parseCreateVisitInput({
      code: 'ESP', name: 'Spain', visitedAt: '2019-03', place: '  Seville ', rating: 4.6,
      notes: 'Again', tags: ['Food', 3, 'Beach'],
    })).toEqual({
      code: 'ESP', name: 'Spain', visitDate: '2019-03-01', place: 'Seville', rating: 5,
      notes: 'Again', tags: '["Food","Beach"]',
    })
  })

  it('stores optional journal fields as null', () => {
    expect(parseCreateVisitInput({ code: 'ESP', name: 'Spain', visitedAt: '2019-03', rating: 9, place: ' ' }))
      .toEqual({ code: 'ESP', name: 'Spain', visitDate: '2019-03-01', place: null, rating: null, notes: null, tags: null })
  })

  it.each([
    [{ name: 'Spain', visitedAt: '2019-03' }],
    [{ code: 'ESP', name: 'Spain' }],
    [{ code: 'ESP', name: 'Spain', visitedAt: '2019-13' }],
    [{ code: 'ESP', name: 'Spain', visitedAt: '' }],
    [null],
    [['ESP']],
  ])('rejects a visit without identity or a valid month: %j', (body) => {
    expect(parseCreateVisitInput(body)).toBeUndefined()
  })

  it('parses an update by id and requires a date', () => {
    expect(parseUpdateVisitInput({ id: 7, visitedAt: '2020-01', notes: 'x' }))
      .toEqual({ id: 7, visitDate: '2020-01-01', place: null, rating: null, notes: 'x', tags: null })
    expect(parseUpdateVisitInput({ id: 7 })).toBeUndefined()
    expect(parseUpdateVisitInput({ visitedAt: '2020-01' })).toBeUndefined()
  })

  it('accepts only positive integer ids', () => {
    expect(parseVisitId({ id: 3 })).toBe(3)
    for (const id of [0, -1, 1.5, '3', null, Number.NaN, 2 ** 60]) {
      expect(parseVisitId({ id })).toBeUndefined()
    }
    expect(parseVisitId(undefined)).toBeUndefined()
  })
})

describe('visit serialising and merging', () => {
  it('serialises a stored visit row', () => {
    expect(serializeVisitRow({
      id: 5, country_code: 'ESP', country_name: 'Spain', visit_date: '2019-03-01',
      place: 'Seville', rating: 5, notes: 'Again', tags: '["Food"]',
    })).toEqual({ id: 5, visitedAt: '2019-03', place: 'Seville', rating: 5, notes: 'Again', tags: ['Food'] })
    expect(serializeVisitRow(visitRow(6, '2021-10-01'))).toEqual({ id: 6, visitedAt: '2021-10' })
  })

  it('attaches extra visits to their own country only, keeping every existing field', () => {
    const merged = mergeCountryVisits(
      [spain, japan, { ...japan, country_code: '-99', country_name: 'France' }],
      [visitRow(2, '2019-03-01'), visitRow(9, '2022-05-01', 'France', '-99'), visitRow(3, '2023-01-01')],
    )
    expect(merged[0]).toEqual({
      code: 'ESP', name: 'Spain', status: 'visited', notes: 'First time', place: 'Madrid',
      visitedAt: '2015-07', rating: 4, tags: ['City'],
      visits: [{ id: 2, visitedAt: '2019-03' }, { id: 3, visitedAt: '2023-01' }],
    })
    expect(merged[1]).toEqual({ code: 'JPN', name: 'Japan', status: 'visited' })
    expect(merged[1]).not.toHaveProperty('visits')
    expect(merged[2].visits).toEqual([{ id: 9, visitedAt: '2022-05' }])
  })

  it('does not attach visits whose country the user no longer has', () => {
    expect(mergeCountryVisits([japan], [visitRow(1, '2019-03-01')])).toEqual([
      { code: 'JPN', name: 'Japan', status: 'visited' },
    ])
  })
})

describe('countries queries', () => {
  it('lists countries and visits in two user-scoped queries (no N+1)', async () => {
    const { database, calls } = fakeDatabase([spain, japan], [visitRow(2, '2019-03-01')])
    const countries = await listCountries(database, 'user-1')
    expect(calls).toHaveLength(2)
    expect(calls.every(c => c.parameters.length === 1 && c.parameters[0] === 'user-1')).toBe(true)
    expect(calls[0].statement).toMatch(/FROM visited_countries\s+WHERE user_id = \$1/)
    expect(calls[1].statement).toMatch(/FROM country_visits\s+WHERE user_id = \$1/)
    expect(countries.map(c => c.visits?.length ?? 0)).toEqual([1, 0])
  })

  it('deletes a country and its visits in one statement', async () => {
    const { database, calls } = fakeDatabase()
    await deleteCountry(database, 'user-1', { code: 'ESP', name: 'Spain' })
    expect(calls).toHaveLength(1)
    expect(calls[0].statement).toMatch(/DELETE FROM country_visits\s+WHERE user_id = \$1 AND country_code = \$2 AND country_name = \$3/)
    expect(calls[0].statement).toMatch(/DELETE FROM visited_countries\s+WHERE user_id = \$1 AND country_code = \$2 AND country_name = \$3/)
    expect(calls[0].parameters).toEqual(['user-1', 'ESP', 'Spain'])
  })

  it('resets countries and visits together', async () => {
    const { database, calls } = fakeDatabase()
    await resetCountries(database, 'user-1')
    expect(calls[0].statement).toMatch(/DELETE FROM country_visits WHERE user_id = \$1/)
    expect(calls[0].statement).toMatch(/DELETE FROM visited_countries WHERE user_id = \$1/)
    expect(calls[0].parameters).toEqual(['user-1'])
  })

  it('never writes to visited_countries except through delete / reset', async () => {
    const { database, calls } = fakeDatabase([visitRow(1, '2019-03-01')], [{ id: 1 }], [])
    const body = { id: 1, code: 'ESP', name: 'Spain', visitedAt: '2019-03' }
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      await handleCountryVisitsRequest({ method, userId: 'u', body, database })
    }
    for (const { statement } of calls) {
      expect(statement).not.toMatch(/(INSERT INTO|UPDATE|DELETE FROM) visited_countries/)
    }
  })
})

describe('handleCountryVisitsRequest', () => {
  const body = { code: 'ESP', name: 'Spain', visitedAt: '2019-03', place: 'Seville' }

  it('returns 401 without a session and never queries', async () => {
    const { database, calls } = fakeDatabase()
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      expect(await handleCountryVisitsRequest({ method, userId: undefined, body, database }))
        .toEqual({ status: 401, body: { error: 'Unauthorized' } })
    }
    expect(calls).toEqual([])
  })

  it('adds a visit for a country the user has and returns it', async () => {
    const { database, calls } = fakeDatabase([{ ...visitRow(12, '2019-03-01'), place: 'Seville' }])
    const response = await handleCountryVisitsRequest({ method: 'post', userId: 'user-1', body, database })
    expect(response).toEqual({ status: 201, body: { id: 12, visitedAt: '2019-03', place: 'Seville' } })
    expect(calls[0].statement).toMatch(/INSERT INTO country_visits/)
    expect(calls[0].statement).toMatch(/WHERE EXISTS \(\s*SELECT 1 FROM visited_countries\s+WHERE user_id = \$1/)
    expect(calls[0].parameters).toEqual(['user-1', 'ESP', 'Spain', '2019-03-01', 'Seville', null, null, null])
  })

  it('returns 404 when the country is not in the user\'s atlas', async () => {
    const { database } = fakeDatabase([])
    expect(await handleCountryVisitsRequest({ method: 'POST', userId: 'u', body, database }))
      .toEqual({ status: 404, body: { error: 'Country not found' } })
  })

  it('updates only the session user\'s visit', async () => {
    const { database, calls } = fakeDatabase([{ id: 4 }], [])
    const update = { id: 4, visitedAt: '2020-02', rating: 3 }
    expect(await handleCountryVisitsRequest({ method: 'PATCH', userId: 'user-1', body: update, database }))
      .toEqual({ status: 204 })
    expect(calls[0].statement).toMatch(/WHERE id = \$6 AND user_id = \$7/)
    expect(calls[0].parameters).toEqual(['2020-02-01', null, 3, null, null, 4, 'user-1'])
    // Someone else's (or a missing) visit updates no row.
    expect(await handleCountryVisitsRequest({ method: 'PATCH', userId: 'user-2', body: update, database }))
      .toEqual({ status: 404, body: { error: 'Visit not found' } })
  })

  it('deletes only the session user\'s visit', async () => {
    const { database, calls } = fakeDatabase()
    expect(await handleCountryVisitsRequest({ method: 'DELETE', userId: 'user-1', body: { id: 4 }, database }))
      .toEqual({ status: 204 })
    expect(calls[0].statement).toBe('DELETE FROM country_visits WHERE id = $1 AND user_id = $2')
    expect(calls[0].parameters).toEqual([4, 'user-1'])
  })

  it('rejects invalid payloads and other methods without querying', async () => {
    const { database, calls } = fakeDatabase()
    const invalid = { status: 400, body: { error: 'Invalid payload' } }
    expect(await handleCountryVisitsRequest({ method: 'POST', userId: 'u', body: { code: 'ESP' }, database })).toEqual(invalid)
    expect(await handleCountryVisitsRequest({ method: 'PATCH', userId: 'u', body: { id: 'x' }, database })).toEqual(invalid)
    expect(await handleCountryVisitsRequest({ method: 'DELETE', userId: 'u', body: undefined, database })).toEqual(invalid)
    expect(await handleCountryVisitsRequest({ method: 'GET', userId: 'u', body, database }))
      .toEqual({ status: 405, body: { error: 'Method not allowed' } })
    expect(calls).toEqual([])
  })
})
