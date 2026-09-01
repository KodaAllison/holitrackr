import { describe, expect, it } from 'vitest'
import { parseStoredStatus, parseUpdateCountryInput } from './countryPayloads'

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
})
