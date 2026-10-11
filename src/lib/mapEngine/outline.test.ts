import { describe, expect, it } from 'vitest'
import { geoEqualEarthRaw } from 'd3-geo'
import { OUTLINE_HALF_HEIGHT, OUTLINE_HALF_WIDTH, outlineHalfWidth, outlineRay, outlineReach } from './outline'

/** The exact outline's half-width at height v, found on the ±180° meridian by bisection on latitude. */
function exactHalfWidth(v: number): number {
  let lo = 0
  let hi = Math.PI / 2
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (geoEqualEarthRaw(Math.PI, mid)[1] < v) lo = mid
    else hi = mid
  }
  return geoEqualEarthRaw(Math.PI, lo)[0]
}

describe('the Equal Earth outline', () => {
  it('is convex: the half-width is concave and falling from the equator to the pole', () => {
    let prevSlope = 0
    let prev = geoEqualEarthRaw(Math.PI, 0)
    for (let i = 1; i <= 2000; i++) {
      const p = geoEqualEarthRaw(Math.PI, (i / 2000) * (Math.PI / 2))
      const slope = (p[0] - prev[0]) / (p[1] - prev[1])
      expect(slope).toBeLessThanOrEqual(1e-12)
      if (i > 1) expect(slope).toBeLessThanOrEqual(prevSlope + 1e-9)
      prevSlope = slope
      prev = p
    }
  })

  it('spans the projection from the equator to the pole', () => {
    expect(OUTLINE_HALF_WIDTH).toBeCloseTo(geoEqualEarthRaw(Math.PI, 0)[0], 12)
    expect(OUTLINE_HALF_HEIGHT).toBeCloseTo(geoEqualEarthRaw(0, Math.PI / 2)[1], 12)
  })

  it('stays just inside the exact outline, by far less than a pixel at any map scale', () => {
    for (let i = 0; i <= 1000; i++) {
      const v = (i / 1000) * OUTLINE_HALF_HEIGHT
      const exact = exactHalfWidth(v)
      const table = outlineHalfWidth(v)
      expect(table).toBeLessThanOrEqual(exact + 1e-12)
      // At the 12x zoom of a 4000px-wide world (scale ~740), 1e-5 is under 0.1px.
      expect(exact - table).toBeLessThan(1e-5)
      expect(outlineHalfWidth(-v)).toBe(table)
    }
  })

  it('reach inverts the half-width', () => {
    for (const v of [0.1, 0.5, 0.9, 1.2, 1.3]) expect(outlineReach(outlineHalfWidth(v))).toBeCloseTo(v, 9)
    expect(outlineReach(0.5)).toBe(OUTLINE_HALF_HEIGHT)
    expect(outlineReach(OUTLINE_HALF_WIDTH + 0.01)).toBe(-1)
  })

  it('the ray meets the outline where the half-width matches its slope', () => {
    for (const ratio of [1.25, 1.7778, 2.5, 10]) {
      const v = outlineRay(ratio)
      expect(outlineHalfWidth(v)).toBeCloseTo(ratio * v, 9)
    }
    // A tall rectangle's corners (up to about 1.217:1) stop on the flat pole line.
    expect(outlineRay(0.6)).toBe(OUTLINE_HALF_HEIGHT)
    expect(outlineRay(1.2)).toBe(OUTLINE_HALF_HEIGHT)
  })
})
