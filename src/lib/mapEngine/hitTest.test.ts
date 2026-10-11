import { describe, expect, it } from 'vitest'
import { findIndexed, hitAt, hoverTarget, pickTarget } from './hitTest'
import { CLUSTER_RADIUS } from './renderer'

const france = { name: 'France' }
const monaco = { name: 'Monaco' }
const vatican = { name: 'Vatican' }
const single = { x: 100, y: 100, members: [monaco] }
const group = { x: 200, y: 200, members: [monaco, vatican] }

describe('hitAt', () => {
  const locate = () => france

  it('prefers a dot or cluster under the point to the country beneath it', () => {
    expect(hitAt([single, group], 100 + CLUSTER_RADIUS - 1, 100, locate)).toBe(single)
    expect(hitAt([single, group], 205, 198, locate)).toBe(group)
  })

  it('falls back to the country at the point, away from every dot', () => {
    expect(hitAt([single], 100 + CLUSTER_RADIUS + 1, 100, locate)).toBe(france)
  })

  it('is null over the sea (or off the globe)', () => {
    expect(hitAt([single], 400, 400, () => null)).toBeNull()
  })

  it('passes the point through to locate', () => {
    const seen: number[][] = []
    hitAt([], 12, 34, (x, y) => { seen.push([x, y]); return null })
    expect(seen).toEqual([[12, 34]])
  })
})

describe('hoverTarget', () => {
  it('names a country, or the one country in a single dot', () => {
    expect(hoverTarget(france)).toBe(france)
    expect(hoverTarget(single)).toBe(monaco)
  })

  it('names nothing over a cluster of several, or over nothing', () => {
    expect(hoverTarget(group)).toBeNull()
    expect(hoverTarget(null)).toBeNull()
  })
})

describe('pickTarget', () => {
  it('opens a country, or the one country in a single dot', () => {
    expect(pickTarget(france)).toEqual({ country: france })
    expect(pickTarget(single)).toEqual({ country: monaco })
  })

  it('zooms into a cluster of several', () => {
    expect(pickTarget(group)).toEqual({ cluster: group })
  })

  it('does nothing over the sea', () => {
    expect(pickTarget(null)).toBeNull()
  })
})

describe('findIndexed', () => {
  const list = [
    { identity: { code: 'FR', name: 'France' } },
    { identity: { code: 'MC', name: 'Monaco' } },
  ]

  it('finds the indexed country for an identity', () => {
    expect(findIndexed(list, { code: 'MC', name: 'Monaco' })).toBe(list[1])
  })

  it('is null for an unknown country, or before the countries load', () => {
    expect(findIndexed(list, { code: 'IT', name: 'Italy' })).toBeNull()
    expect(findIndexed(null, { code: 'FR', name: 'France' })).toBeNull()
  })
})
