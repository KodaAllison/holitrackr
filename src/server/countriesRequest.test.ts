import { describe, expect, it } from 'vitest'
import { handleCountriesRequest } from './countriesRequest'
import type { CountriesDatabase } from './countryVisits'

function recordingDatabase() {
  const calls: { statement: string; parameters: unknown[] }[] = []
  const database: CountriesDatabase = {
    query: async (statement, parameters) => {
      calls.push({ statement, parameters })
      return { rows: [] }
    },
  }
  return { database, calls }
}

const request = (over: Partial<Parameters<typeof handleCountriesRequest>[0]>) => {
  const { database } = recordingDatabase()
  return { method: 'GET', userId: 'u1', body: undefined, reset: false, database, ...over }
}

describe('handleCountriesRequest', () => {
  it('rejects a signed-out caller before touching the database', async () => {
    const { database, calls } = recordingDatabase()
    const response = await handleCountriesRequest(request({ userId: undefined, database }))
    expect(response.status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('lists the session user\'s countries', async () => {
    const response = await handleCountriesRequest(request({}))
    expect(response).toEqual({ status: 200, body: [] })
  })

  it('upserts a country scoped to the session user', async () => {
    const { database, calls } = recordingDatabase()
    const response = await handleCountriesRequest(
      request({ method: 'POST', body: { code: 'JP', name: 'Japan', status: 'visited' }, database })
    )
    expect(response.status).toBe(204)
    expect(calls[0].parameters.slice(0, 4)).toEqual(['u1', 'JP', 'Japan', 'visited'])
  })

  it('rejects invalid POST, PATCH and DELETE payloads with 400', async () => {
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      const response = await handleCountriesRequest(request({ method, body: { nope: true } }))
      expect(response.status).toBe(400)
    }
  })

  it('resets without a body when reset is set', async () => {
    const { database, calls } = recordingDatabase()
    const response = await handleCountriesRequest(request({ method: 'DELETE', reset: true, database }))
    expect(response.status).toBe(204)
    expect(calls[0].parameters).toEqual(['u1'])
  })

  it('answers other methods with 405', async () => {
    expect((await handleCountriesRequest(request({ method: 'PUT' }))).status).toBe(405)
  })
})
