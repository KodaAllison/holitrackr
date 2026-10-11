import { describe, expect, it } from 'vitest'
import type { StoredCountryRow } from '../types/countriesApi'
import { handleCountriesRequest } from './countriesHandler'
import type { CountriesDatabase } from './countryVisits'

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
  notes: null, place: null, visit_date: '2015-07-01', rating: null, tags: null,
}

describe('handleCountriesRequest', () => {
  it.each(['GET', 'POST', 'PATCH', 'DELETE', 'PUT'])('rejects a signed-out %s before touching the database', async (method) => {
    const { database, calls } = fakeDatabase()
    expect(await handleCountriesRequest({ method, userId: undefined, body: {}, reset: true, database }))
      .toEqual({ status: 401, body: { error: 'Unauthorized' } })
    expect(calls).toEqual([])
  })

  it('lists the session user\'s countries', async () => {
    const { database, calls } = fakeDatabase([spain], [])
    const response = await handleCountriesRequest({ method: 'GET', userId: 'u1', body: undefined, reset: false, database })
    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      expect.objectContaining({ code: 'ESP', name: 'Spain', status: 'visited', visitedAt: '2015-07' }),
    ])
    expect(calls.every(call => call.parameters[0] === 'u1')).toBe(true)
  })

  it('upserts a country on POST, defaulting to visited', async () => {
    const { database, calls } = fakeDatabase()
    const response = await handleCountriesRequest({
      method: 'post', userId: 'u1', body: { code: 'ESP', name: 'Spain' }, reset: false, database,
    })
    expect(response).toEqual({ status: 204 })
    expect(calls).toHaveLength(1)
    expect(calls[0].statement).toContain('ON CONFLICT (user_id, country_code, country_name)')
    expect(calls[0].parameters).toEqual(['u1', 'ESP', 'Spain', 'visited', null])
  })

  it('rejects a POST with a bad status or no identity', async () => {
    const { database, calls } = fakeDatabase()
    expect(await handleCountriesRequest({
      method: 'POST', userId: 'u1', body: { code: 'ESP', name: 'Spain', status: 'nope' }, reset: false, database,
    })).toEqual({ status: 400, body: { error: 'Invalid status' } })
    expect(await handleCountriesRequest({
      method: 'POST', userId: 'u1', body: { name: 'Spain' }, reset: false, database,
    })).toEqual({ status: 400, body: { error: 'Invalid payload' } })
    expect(calls).toEqual([])
  })

  it('updates the journal on PATCH, scoped to the user', async () => {
    const { database, calls } = fakeDatabase()
    const response = await handleCountriesRequest({
      method: 'PATCH', userId: 'u1', reset: false, database,
      body: { code: 'ESP', name: 'Spain', notes: 'Lovely', place: ' Madrid ', visitedAt: '2015-07', rating: 4, tags: ['City'] },
    })
    expect(response).toEqual({ status: 204 })
    expect(calls[0].statement).toContain('UPDATE visited_countries SET')
    expect(calls[0].parameters).toEqual(['Lovely', 'Madrid', '2015-07-01', 4, '["City"]', 'u1', 'ESP', 'Spain'])
  })

  it('rejects a PATCH without identity', async () => {
    const { database, calls } = fakeDatabase()
    expect(await handleCountriesRequest({ method: 'PATCH', userId: 'u1', body: undefined, reset: false, database }))
      .toEqual({ status: 400, body: { error: 'Invalid payload' } })
    expect(calls).toEqual([])
  })

  it('deletes one country and its visits on DELETE', async () => {
    const { database, calls } = fakeDatabase()
    const response = await handleCountriesRequest({
      method: 'DELETE', userId: 'u1', body: { code: 'ESP', name: 'Spain' }, reset: false, database,
    })
    expect(response).toEqual({ status: 204 })
    expect(calls).toHaveLength(1)
    expect(calls[0].parameters).toEqual(['u1', 'ESP', 'Spain'])
  })

  it('resets everything for DELETE ?reset=true without needing a body', async () => {
    const { database, calls } = fakeDatabase()
    const response = await handleCountriesRequest({
      method: 'DELETE', userId: 'u1', body: undefined, reset: true, database,
    })
    expect(response).toEqual({ status: 204 })
    expect(calls).toHaveLength(1)
    expect(calls[0].parameters).toEqual(['u1'])
  })

  it('rejects a DELETE without identity', async () => {
    const { database, calls } = fakeDatabase()
    expect(await handleCountriesRequest({ method: 'DELETE', userId: 'u1', body: {}, reset: false, database }))
      .toEqual({ status: 400, body: { error: 'Invalid payload' } })
    expect(calls).toEqual([])
  })

  it('answers 405 for other methods', async () => {
    const { database, calls } = fakeDatabase()
    expect(await handleCountriesRequest({ method: 'PUT', userId: 'u1', body: {}, reset: false, database }))
      .toEqual({ status: 405, body: { error: 'Method not allowed' } })
    expect(calls).toEqual([])
  })
})
