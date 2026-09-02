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
