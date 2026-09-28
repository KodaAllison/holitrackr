import { describe, expect, it } from 'vitest'
import type { Feature, GeoJsonProperties, Geometry } from 'geojson'
import { featureIdentity, featureName } from './featureIdentity'

function feature(properties: GeoJsonProperties): Feature<Geometry, GeoJsonProperties> {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties }
}

describe('featureIdentity', () => {
  it('reads the primary property names', () => {
    expect(featureIdentity(feature({ name: 'Spain', 'ISO3166-1-Alpha-3': 'ESP' })))
      .toEqual({ code: 'ESP', name: 'Spain' })
  })

  it('falls back to ADMIN and ISO_A3', () => {
    expect(featureIdentity(feature({ ADMIN: 'Japan', ISO_A3: 'JPN' })))
      .toEqual({ code: 'JPN', name: 'Japan' })
  })

  it('prefers the primary names when both are present', () => {
    expect(featureIdentity(feature({
      name: 'France', ADMIN: 'French Republic', 'ISO3166-1-Alpha-3': '-99', ISO_A3: 'FRA',
    }))).toEqual({ code: '-99', name: 'France' })
  })

  it('skips empty and non-string values in the fallback chain', () => {
    expect(featureIdentity(feature({ name: '', ADMIN: 'Chile', 'ISO3166-1-Alpha-3': 42, ISO_A3: 'CHL' })))
      .toEqual({ code: 'CHL', name: 'Chile' })
  })

  it('returns null when the code is missing', () => {
    expect(featureIdentity(feature({ name: 'Somewhere' }))).toBeNull()
  })

  it('returns null when the name is missing', () => {
    expect(featureIdentity(feature({ ISO_A3: 'ESP' }))).toBeNull()
  })

  it('returns null for absent features and properties', () => {
    expect(featureIdentity(undefined)).toBeNull()
    expect(featureIdentity(feature(null))).toBeNull()
  })
})

describe('featureName', () => {
  it('returns the name even without a code', () => {
    expect(featureName(feature({ name: 'Somewhere' }))).toBe('Somewhere')
  })

  it('returns undefined when there is no usable name', () => {
    expect(featureName(feature({ name: 7 }))).toBeUndefined()
  })
})
