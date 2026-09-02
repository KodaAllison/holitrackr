import { describe, expect, it } from 'vitest'
import {
  parseStoredStatus,
  parseUpdateCountryInput,
  serializeStoredCountry,
} from './countryPayloads'

describe('country payload parsing', () => {
  it('accepts real calendar months and rejects out-of-range months', () => {
    expect(parseUpdateCountryInput({ code: 'ESP', name: 'Spain', visitedAt: '2026-12' }))
      .toMatchObject({ visitDate: '2026-12-01' })
    expect(parseUpdateCountryInput({ code: 'ESP', name: 'Spain', visitedAt: '2026-00' }))
      .toMatchObject({ visitDate: null })
    expect(parseUpdateCountryInput({ code: 'ESP', name: 'Spain', visitedAt: '2026-13' }))
      .toMatchObject({ visitDate: null })
  })

  it('normalizes persisted statuses to the public country contract', () => {
    expect(parseStoredStatus('visited')).toBe('visited')
    expect(parseStoredStatus('bucketlist')).toBe('bucketlist')
    expect(parseStoredStatus('unexpected')).toBe('visited')
  })

  it('serializes stored rows through the shared countries API DTO', () => {
    expect(serializeStoredCountry({
      country_code: 'ESP',
      country_name: 'Spain',
      status: 'visited',
      notes: 'Summer',
      visit_date: '2026-08-01',
      rating: 5,
      tags: '["food",2,"beach"]',
    })).toEqual({
      code: 'ESP',
      name: 'Spain',
      status: 'visited',
      notes: 'Summer',
      visitedAt: '2026-08',
      rating: 5,
      tags: ['food', 'beach'],
    })
  })
})
