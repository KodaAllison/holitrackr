import { describe, expect, it } from 'vitest'
import { geoEqualEarthRaw, geoOrthographicRaw } from 'd3-geo'
import { morphRaw, unfoldedOrthographicRaw } from './morph'

const rad = (d: number) => (d * Math.PI) / 180

describe('unfoldedOrthographicRaw', () => {
  it('matches orthographic on the near hemisphere', () => {
    for (const [l, p] of [[0, 0], [30, 45], [-80, -20]]) {
      const [x, y] = unfoldedOrthographicRaw(rad(l), rad(p))
      const [ox, oy] = geoOrthographicRaw(rad(l), rad(p))
      expect(x).toBeCloseTo(ox)
      expect(y).toBeCloseTo(oy)
    }
  })

  it('puts the far hemisphere outside the globe, not on top of it', () => {
    for (const [l, p] of [[180, 0], [120, 30], [-150, -40]]) {
      const [x, y] = unfoldedOrthographicRaw(rad(l), rad(p))
      expect(Math.hypot(x, y)).toBeGreaterThan(1)
    }
  })
})

describe('morphRaw', () => {
  it('is Equal Earth at t = 1', () => {
    const [x, y] = morphRaw(1)(rad(100), rad(-35))
    const [ex, ey] = geoEqualEarthRaw(rad(100), rad(-35))
    expect(x).toBeCloseTo(ex)
    expect(y).toBeCloseTo(ey)
  })

  it('is halfway between the two at t = 0.5', () => {
    const [x] = morphRaw(0.5)(rad(40), rad(10))
    const [a] = unfoldedOrthographicRaw(rad(40), rad(10))
    const [b] = geoEqualEarthRaw(rad(40), rad(10))
    expect(x).toBeCloseTo((a + b) / 2)
  })
})
