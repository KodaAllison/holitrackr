import { describe, expect, it } from 'vitest'
import {
  MAX_PLACE_LENGTH,
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

  it('trims place, caps its length, and stores blank as null', () => {
    expect(parseUpdateCountryInput({ code: 'JPN', name: 'Japan', place: '  Kyoto & Osaka ' }))
      .toMatchObject({ place: 'Kyoto & Osaka' })
    expect(parseUpdateCountryInput({ code: 'JPN', name: 'Japan', place: '   ' }))
      .toMatchObject({ place: null })
    expect(parseUpdateCountryInput({ code: 'JPN', name: 'Japan', place: 42 }))
      .toMatchObject({ place: null })
    expect(parseUpdateCountryInput({ code: 'JPN', name: 'Japan', place: 'x'.repeat(500) })?.place)
      .toHaveLength(MAX_PLACE_LENGTH)
  })

  it('omits place from the DTO when none is stored', () => {
    expect(serializeStoredCountry({
      country_code: 'JPN', country_name: 'Japan', status: 'bucketlist',
      notes: null, place: null, visit_date: '2027-04-01', rating: null, tags: null,
    })).toEqual({ code: 'JPN', name: 'Japan', status: 'bucketlist', visitedAt: '2027-04' })
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
      place: 'Barcelona',
      visit_date: '2026-08-01',
      rating: 5,
      tags: '["food",2,"beach"]',
    })).toEqual({
      code: 'ESP',
      name: 'Spain',
      status: 'visited',
      notes: 'Summer',
      place: 'Barcelona',
      visitedAt: '2026-08',
      rating: 5,
      tags: ['food', 'beach'],
    })
  })
})
