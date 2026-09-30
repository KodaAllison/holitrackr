import { describe, expect, it, vi } from 'vitest'
import type { VisitedCountry } from '../types/country'
import {
  CountriesClientError,
  createHttpCountriesClient,
  createInMemoryCountriesClient,
} from './countriesClient'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('HTTP countries client', () => {
  it('loads and validates the complete country wire shape', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([
      {
        code: 'ESP',
        name: 'Spain',
        status: 'visited',
        notes: 'Summer',
        visitedAt: '2026-08',
        rating: 5,
        tags: ['beach', 'food'],
      },
      { code: 'JPN', name: 'Japan', status: 'bucketlist' },
    ]))
    const client = createHttpCountriesClient(fetcher)

    await expect(client.list()).resolves.toEqual([
      {
        code: 'ESP',
        name: 'Spain',
        status: 'visited',
        notes: 'Summer',
        visitedAt: '2026-08',
        rating: 5,
        tags: ['beach', 'food'],
      },
      { code: 'JPN', name: 'Japan', status: 'bucketlist' },
    ])
    expect(fetcher).toHaveBeenCalledWith('/api/countries', {
      method: 'GET',
      credentials: 'include',
    })
  })

  it.each([
    { body: {}, label: 'a non-array response' },
    { body: [{ code: 'ESP', name: 'Spain', status: 'unknown' }], label: 'an invalid status' },
    { body: [{ code: 'ESP', name: 'Spain', status: 'visited', tags: ['ok', 1] }], label: 'invalid tags' },
  ])('rejects $label instead of treating it as an empty account', async ({ body }) => {
    const client = createHttpCountriesClient(
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(body))
    )

    await expect(client.list()).rejects.toThrow('invalid response')
  })

  it('throws a typed error for a failed HTTP response', async () => {
    const client = createHttpCountriesClient(
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Unavailable' }, 503))
    )

    const expectedError: Partial<CountriesClientError> = {
      name: 'CountriesClientError',
      status: 503,
    }
    await expect(client.list()).rejects.toMatchObject(expectedError)
  })

  it('sends every mutation through the same authenticated JSON seam', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    const client = createHttpCountriesClient(fetcher)
    const spain: VisitedCountry = {
      code: 'ESP',
      name: 'Spain',
      status: 'visited',
      visitedAt: '2026-08',
      rating: 5,
      tags: ['food'],
    }

    await client.add(spain)
    await client.remove(spain)
    await client.updateJournal(spain, {
      notes: 'Summer',
      place: '  ',
      visitedAt: '',
      rating: undefined,
      tags: ['food'],
    })
    await client.reset()

    expect(fetcher.mock.calls).toEqual([
      ['/api/countries', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'ESP', name: 'Spain', status: 'visited' }),
      }],
      ['/api/countries', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'ESP', name: 'Spain' }),
      }],
      ['/api/countries', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'ESP',
          name: 'Spain',
          notes: 'Summer',
          place: null,
          visitedAt: null,
          rating: null,
          tags: ['food'],
        }),
      }],
      ['/api/countries?reset=true', {
        method: 'DELETE',
        credentials: 'include',
      }],
    ])
  })

  it('rejects failed mutations', async () => {
    const client = createHttpCountriesClient(
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401))
    )

    await expect(client.reset()).rejects.toMatchObject({ status: 401 })
  })
})

describe('in-memory countries client', () => {
  it('matches the production fields persisted by add', async () => {
    const client = createInMemoryCountriesClient()
    const country: VisitedCountry = {
      code: 'ESP',
      name: 'Spain',
      status: 'visited',
      notes: 'Kept',
      visitedAt: '2026-08',
      rating: 5,
      tags: ['not-persisted-by-add'],
    }

    await client.add(country)

    await expect(client.list()).resolves.toEqual([
      { code: 'ESP', name: 'Spain', status: 'visited', notes: 'Kept' },
    ])
  })

  it('implements the same list, upsert, journal, remove, and reset contract', async () => {
    const client = createInMemoryCountriesClient([
      { code: 'ESP', name: 'Spain', status: 'visited', notes: 'Keep me' },
    ])

    await client.add({ code: 'ESP', name: 'Spain', status: 'bucketlist' })
    await client.add({ code: 'JPN', name: 'Japan', status: 'bucketlist' })
    await client.updateJournal({ code: 'JPN', name: 'Japan' }, {
      notes: 'Spring',
      place: ' Kyoto & Osaka ',
      visitedAt: '2027-04',
      rating: 4,
      tags: ['food'],
    })

    await expect(client.list()).resolves.toEqual([
      { code: 'ESP', name: 'Spain', status: 'bucketlist', notes: 'Keep me' },
      {
        code: 'JPN',
        name: 'Japan',
        status: 'bucketlist',
        notes: 'Spring',
        place: 'Kyoto & Osaka',
        visitedAt: '2027-04',
        rating: 4,
        tags: ['food'],
      },
    ])

    await client.remove({ code: 'ESP', name: 'Spain' })
    await expect(client.list()).resolves.toHaveLength(1)
    await client.reset()
    await expect(client.list()).resolves.toEqual([])
  })

  it('returns snapshots that cannot mutate adapter state', async () => {
    const client = createInMemoryCountriesClient([
      { code: 'ESP', name: 'Spain', status: 'visited', tags: ['food'] },
    ])

    const countries = await client.list()
    countries[0].name = 'Changed'
    countries[0].tags?.push('mutated')

    await expect(client.list()).resolves.toEqual([
      { code: 'ESP', name: 'Spain', status: 'visited', tags: ['food'] },
    ])
  })
})

describe('countries client: extra visits', () => {
  const values = { notes: 'Again', place: ' Seville ', visitedAt: '2019-03', rating: 4, tags: ['Food'] }

  it('loads extra visits and rejects malformed ones', async () => {
    const good = [{ code: 'ESP', name: 'Spain', status: 'visited', visitedAt: '2015-07',
      visits: [{ id: 2, visitedAt: '2019-03', place: 'Seville', rating: 5, tags: ['Food'] }] }]
    await expect(createHttpCountriesClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(good))).list())
      .resolves.toEqual([{ code: 'ESP', name: 'Spain', status: 'visited', visitedAt: '2015-07',
        visits: [{ id: 2, visitedAt: '2019-03', place: 'Seville', rating: 5, tags: ['Food'] }] }])

    for (const visits of [{}, [{ id: 'x', visitedAt: '2019-03' }], [{ id: 1 }], [{ id: 1, visitedAt: '2019-03', rating: 9 }]]) {
      const client = createHttpCountriesClient(vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse([{ code: 'ESP', name: 'Spain', status: 'visited', visits }])
      ))
      await expect(client.list()).rejects.toThrow('invalid response')
    }
  })

  it('sends visit mutations to /api/countries/visits and returns the created visit', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ id: 12, visitedAt: '2019-03', place: 'Seville', rating: 4, notes: 'Again', tags: ['Food'] }, 201))
      .mockResolvedValue(new Response(null, { status: 204 }))
    const client = createHttpCountriesClient(fetcher)

    await expect(client.addVisit({ code: 'ESP', name: 'Spain' }, values)).resolves.toEqual(
      { id: 12, visitedAt: '2019-03', place: 'Seville', rating: 4, notes: 'Again', tags: ['Food'] }
    )
    await client.updateVisit(12, { ...values, place: '', rating: undefined })
    await client.removeVisit(12)

    const request = (method: string, body: unknown) => ['/api/countries/visits', {
      method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }]
    expect(fetcher.mock.calls).toEqual([
      request('POST', { code: 'ESP', name: 'Spain', notes: 'Again', place: 'Seville', visitedAt: '2019-03', rating: 4, tags: ['Food'] }),
      request('PATCH', { id: 12, notes: 'Again', place: null, visitedAt: '2019-03', rating: null, tags: ['Food'] }),
      request('DELETE', { id: 12 }),
    ])
  })

  it('rejects a failed or malformed add', async () => {
    const failed = createHttpCountriesClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Country not found' }, 404)))
    await expect(failed.addVisit({ code: 'ESP', name: 'Spain' }, values)).rejects.toMatchObject({ status: 404 })
    const malformed = createHttpCountriesClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ id: 1 }, 201)))
    await expect(malformed.addVisit({ code: 'ESP', name: 'Spain' }, values)).rejects.toThrow('invalid response')
  })

  it('in memory: adds, orders, edits and removes visits like the API', async () => {
    const client = createInMemoryCountriesClient([
      { code: 'ESP', name: 'Spain', status: 'visited', visitedAt: '2015-07', visits: [{ id: 4, visitedAt: '2023-01' }] },
    ])
    const added = await client.addVisit({ code: 'ESP', name: 'Spain' }, values)
    expect(added).toEqual({ id: 5, visitedAt: '2019-03', place: 'Seville', rating: 4, notes: 'Again', tags: ['Food'] })
    expect((await client.list())[0].visits?.map(v => v.id)).toEqual([5, 4])

    await client.updateVisit(5, { ...values, visitedAt: '2024-02' })
    expect((await client.list())[0].visits?.map(v => [v.id, v.visitedAt])).toEqual([[4, '2023-01'], [5, '2024-02']])

    await client.removeVisit(4)
    await client.removeVisit(5)
    expect((await client.list())[0]).toEqual({ code: 'ESP', name: 'Spain', status: 'visited', visitedAt: '2015-07' })
  })

  it('in memory: rejects visits for unknown countries, undated visits and unknown ids', async () => {
    const client = createInMemoryCountriesClient([{ code: 'ESP', name: 'Spain', status: 'visited' }])
    await expect(client.addVisit({ code: 'JPN', name: 'Japan' }, values)).rejects.toMatchObject({ status: 404 })
    await expect(client.addVisit({ code: 'ESP', name: 'Spain' }, { ...values, visitedAt: '' })).rejects.toMatchObject({ status: 400 })
    await expect(client.updateVisit(99, values)).rejects.toMatchObject({ status: 404 })
  })

  it('in memory: removing a country drops its visits', async () => {
    const client = createInMemoryCountriesClient([{ code: 'ESP', name: 'Spain', status: 'visited' }])
    await client.addVisit({ code: 'ESP', name: 'Spain' }, values)
    await client.remove({ code: 'ESP', name: 'Spain' })
    await client.add({ code: 'ESP', name: 'Spain', status: 'visited' })
    expect((await client.list())[0].visits).toBeUndefined()
  })

  it('in memory: visit snapshots cannot mutate adapter state', async () => {
    const client = createInMemoryCountriesClient([
      { code: 'ESP', name: 'Spain', status: 'visited', visits: [{ id: 1, visitedAt: '2019-03', tags: ['Food'] }] },
    ])
    const [spain] = await client.list()
    spain.visits?.[0].tags?.push('mutated')
    spain.visits?.push({ id: 2, visitedAt: '2020-01' })
    expect((await client.list())[0].visits).toEqual([{ id: 1, visitedAt: '2019-03', tags: ['Food'] }])
  })
})
