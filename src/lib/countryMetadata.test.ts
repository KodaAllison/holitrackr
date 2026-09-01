import { describe, expect, it } from 'vitest'
import { canonicalCountryMetadata } from './countryMetadata'
import { getContinent } from './continents'

describe('canonical public country metadata', () => {
  it('covers every ISO country plus the documented Kosovo compatibility code', () => {
    expect(Object.keys(canonicalCountryMetadata)).toHaveLength(250)
    expect(canonicalCountryMetadata).toMatchObject({
      JPN: { alpha2: 'JP', name: 'Japan' },
      USA: { alpha2: 'US', name: 'United States of America' },
      XKX: { alpha2: 'XK', name: 'Kosovo' },
    })
    expect(canonicalCountryMetadata).not.toHaveProperty('XKK')
  })

  it('assigns every canonical entry to a supported continent', () => {
    for (const [alpha3, metadata] of Object.entries(canonicalCountryMetadata)) {
      expect(getContinent(alpha3, metadata.name), alpha3).not.toBe('Other')
    }
  })
})
