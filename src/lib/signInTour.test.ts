import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decodeWorld } from './worldAtlas'
import { buildCountryIndex } from './mapEngine/countryIndex'
import { buildTour, DEMO_TOUR, STEP_SECONDS, tourAt } from './signInTour'

const world = decodeWorld(JSON.parse(readFileSync(new URL('../data/world-motion.topo.json', import.meta.url), 'utf8')))
const stops = buildTour(buildCountryIndex(world))

describe('buildTour', () => {
  it('finds every demo country in the atlas', () => {
    expect(stops).toHaveLength(DEMO_TOUR.length)
  })

  it('orders stops west to east', () => {
    const lons = stops.map(s => s.country.anchor[0])
    expect(lons).toEqual([...lons].sort((a, b) => a - b))
  })
})

describe('tourAt', () => {
  const visited = stops.filter(s => s.status === 'visited').length

  it('lights stops up in order and counts only visited ones', () => {
    const mid = tourAt(stops, STEP_SECONDS * 5 + 0.5, false)
    expect(mid.index).toBe(5)
    expect(mid.fill(0)).toBe(1)
    expect(mid.fill(9)).toBe(0)
    expect(mid.count).toBe(stops.slice(0, 6).filter(s => s.status === 'visited').length)
  })

  it('loops back to the start', () => {
    expect(tourAt(stops, STEP_SECONDS * stops.length + 0.1, false).index).toBe(0)
  })

  it('is a still, fully lit frame with reduced motion', () => {
    const still = tourAt(stops, 123, true)
    expect(stops[still.index].country.identity.name).toBe('Italy')
    expect(still.fill(0)).toBe(1)
    expect(still.count).toBe(visited)
    expect(tourAt(stops, 0, true)).toMatchObject({ index: still.index, count: visited })
  })

  it('shows the callout only while lingering', () => {
    expect(tourAt(stops, STEP_SECONDS * 2 + STEP_SECONDS * 0.3, false).calloutAlpha).toBe(1)
    expect(tourAt(stops, STEP_SECONDS * 2 + STEP_SECONDS * 0.9, false).calloutAlpha).toBe(0)
  })
})
