import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decodeWorld } from '../worldAtlas'
import { buildCountryIndex, countryAt, MICRO_AREA } from './countryIndex'

const world = decodeWorld(JSON.parse(
  readFileSync(new URL('../../data/world-detail.topo.json', import.meta.url), 'utf8')
))
const index = buildCountryIndex(world)
const byName = (name: string) => index.find(c => c.identity.name === name)

describe('buildCountryIndex', () => {
  it('indexes every country', () => {
    expect(index).toHaveLength(258)
  })

  it('winds rings the way d3-geo expects (no country covers the globe)', () => {
    for (const c of index) expect(c.area, c.identity.name).toBeLessThan(2 * Math.PI)
  })

  it('anchors a country on its largest landmass', () => {
    // France's anchor must be in Europe, not pulled towards French Guiana.
    const [lon, lat] = byName('France')!.anchor // test data: France exists
    expect(lon).toBeGreaterThan(-5)
    expect(lon).toBeLessThan(8)
    expect(lat).toBeGreaterThan(43)
    expect(lat).toBeLessThan(49)
  })

  it('flags micro-states as small', () => {
    expect(byName('Vatican')!.area).toBeLessThan(MICRO_AREA) // test data
    expect(byName('Malta')!.area).toBeLessThan(MICRO_AREA) // test data
    expect(byName('France')!.area).toBeGreaterThan(MICRO_AREA) // test data
  })
})

describe('countryAt', () => {
  it('finds the country under a point', () => {
    expect(countryAt(index, [2.35, 48.86])?.identity).toEqual({ code: '-99', name: 'France' })
    expect(countryAt(index, [139.69, 35.69])?.identity.code).toBe('JPN')
    expect(countryAt(index, [-3.7, 40.42])?.identity.code).toBe('ESP')
  })

  it('returns null for open sea', () => {
    expect(countryAt(index, [-30, 30])).toBeNull()
    expect(countryAt(index, [-150, 0])).toBeNull()
  })

  it('handles countries that cross the antimeridian', () => {
    // Chukotka, east of 180°, is Russia; Fiji straddles the line.
    expect(countryAt(index, [-175, 66])?.identity.code).toBe('RUS')
    expect(countryAt(index, [178.1, -17.8])?.identity.code).toBe('FJI')
  })
})
