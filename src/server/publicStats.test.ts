import { describe, expect, it, vi } from 'vitest'
import { handlePublicStatsRequest } from './publicStats'

const fixedNow = new Date('2026-09-01T12:00:00.000Z')

describe('public stats HTTP contract', () => {
  it('returns canonical, sorted stats without private database fields', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        { country_code: 'ESP', country_name: 'Madrid, 2026-09', notes: 'private', user_id: 'owner' },
        { country_code: '-99', country_name: 'France', visit_date: '2026-05-01' },
        { country_code: '-99', country_name: 'Norway', rating: 5 },
        { country_code: '-99', country_name: 'Kosovo', tags: '["private"]' },
        { country_code: 'ESP', country_name: 'Spain' },
        { country_code: '-99', country_name: 'Northern Cyprus' },
        { country_code: '-99', country_name: 'Somaliland' },
        { country_code: 'ZZZ', country_name: 'Unknown' },
      ],
    })

    const response = await handlePublicStatsRequest({
      method: 'GET',
      ownerUserId: 'portfolio-owner',
      origin: undefined,
      database: { query },
      now: () => fixedNow,
    })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      countries: [
        { alpha3: 'FRA', alpha2: 'FR', name: 'France', continent: 'Europe' },
        { alpha3: 'XKX', alpha2: 'XK', name: 'Kosovo', continent: 'Europe' },
        { alpha3: 'NOR', alpha2: 'NO', name: 'Norway', continent: 'Europe' },
        { alpha3: 'ESP', alpha2: 'ES', name: 'Spain', continent: 'Europe' },
      ],
      countryCount: 4,
      continentCount: 1,
      continents: ['Europe'],
      generatedAt: '2026-09-01T12:00:00.000Z',
    })
    expect(JSON.stringify(response.body)).not.toMatch(/notes|visit_date|rating|tags|user_id/)
  })

  it('queries only public columns for the configured owner', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] })

    await handlePublicStatsRequest({
      method: 'GET',
      ownerUserId: 'portfolio-owner',
      origin: undefined,
      database: { query },
      now: () => fixedNow,
    })

    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/^\s*SELECT country_code, country_name\s+FROM visited_countries\s+WHERE user_id = \$1 AND status = 'visited'\s*$/),
      ['portfolio-owner'],
    )
  })

  it('repairs -99 only when the stored name exactly matches an approved case', async () => {
    const response = await handlePublicStatsRequest({
      method: 'GET',
      ownerUserId: 'owner',
      origin: undefined,
      database: {
        query: vi.fn().mockResolvedValue({
          rows: [
            { country_code: '-99', country_name: ' France ' },
            { country_code: '-99', country_name: 'Northern Cyprus' },
            { country_code: '-99', country_name: 'Somaliland' },
          ],
        }),
      },
      now: () => fixedNow,
    })

    expect(response.body).toMatchObject({ countries: [], countryCount: 0 })
  })

  it('adds CORS permission only for an approved browser origin', async () => {
    const database = { query: vi.fn().mockResolvedValue({ rows: [] }) }

    const approved = await handlePublicStatsRequest({
      method: 'GET', ownerUserId: 'owner', origin: 'https://kodaallison.dev', database, now: () => fixedNow,
    })
    const unapproved = await handlePublicStatsRequest({
      method: 'GET', ownerUserId: 'owner', origin: 'https://example.com', database, now: () => fixedNow,
    })

    expect(approved.headers['Access-Control-Allow-Origin']).toBe('https://kodaallison.dev')
    expect(unapproved.headers['Access-Control-Allow-Origin']).toBeUndefined()
    expect(approved.headers.Vary).toBe('Origin')
    expect(unapproved.headers.Vary).toBe('Origin')
  })

  it('marks successful data as CDN-cacheable with background revalidation', async () => {
    const response = await handlePublicStatsRequest({
      method: 'GET',
      ownerUserId: 'owner',
      origin: undefined,
      database: { query: vi.fn().mockResolvedValue({ rows: [] }) },
      now: () => fixedNow,
    })

    expect(response.headers['Cache-Control']).toBe('public, s-maxage=3600, stale-while-revalidate=86400')
  })

  it('returns a generic no-store 503 when no owner is configured', async () => {
    const query = vi.fn()
    const response = await handlePublicStatsRequest({
      method: 'GET', ownerUserId: undefined, origin: undefined, database: { query }, now: () => fixedNow,
    })

    expect(response).toMatchObject({
      status: 503,
      headers: { 'Cache-Control': 'no-store', Vary: 'Origin' },
      body: { error: 'Public stats unavailable' },
    })
    expect(query).not.toHaveBeenCalled()
  })

  it('serves preflight without querying the database', async () => {
    const query = vi.fn()
    const response = await handlePublicStatsRequest({
      method: 'OPTIONS',
      ownerUserId: undefined,
      origin: 'https://www.kodaallison.dev',
      database: { query },
      now: () => fixedNow,
    })

    expect(response).toMatchObject({
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': 'https://www.kodaallison.dev',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'no-store',
      },
    })
    expect(query).not.toHaveBeenCalled()
  })

  it('returns a generic no-store 500 when the database fails', async () => {
    const response = await handlePublicStatsRequest({
      method: 'GET',
      ownerUserId: 'owner',
      origin: undefined,
      database: { query: vi.fn().mockRejectedValue(new Error('database unavailable')) },
      now: () => fixedNow,
    })

    expect(response).toMatchObject({
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
      body: { error: 'Failed to load public stats' },
    })
  })
})
