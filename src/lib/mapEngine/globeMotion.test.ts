import { describe, expect, it } from 'vitest'
import { centerOf, decay, dragRotate, ease, facing, MAX_TILT, turnTo, wrapLon } from './globeMotion'

describe('wrapLon', () => {
  it('keeps longitudes in [-180, 180)', () => {
    expect(wrapLon(190)).toBe(-170)
    expect(wrapLon(-190)).toBe(170)
    expect(wrapLon(540)).toBe(-180)
    expect(wrapLon(45)).toBe(45)
  })
})

describe('facing / centerOf', () => {
  it('round-trips a point that needs no tilt limit', () => {
    const [lon, lat] = centerOf(facing([2.35, 48.86]))
    expect(lon).toBeCloseTo(2.35)
    expect(lat).toBeCloseTo(48.86)
  })

  it('limits the tilt towards the poles', () => {
    expect(facing([0, 85])[1]).toBe(-60)
  })
})

describe('dragRotate', () => {
  it('turns one radian per radius of drag', () => {
    const [lambda] = dragRotate([0, 0], 100, 0, 100)
    expect(lambda).toBeCloseTo(180 / Math.PI)
  })

  it('never tilts past the limit', () => {
    expect(dragRotate([0, 0], 0, -100_000, 100)[1]).toBe(MAX_TILT)
    expect(dragRotate([0, 0], 0, 100_000, 100)[1]).toBe(-MAX_TILT)
  })
})

describe('decay', () => {
  it('slows down over time and never reverses', () => {
    expect(decay(1, 100)).toBeLessThan(1)
    expect(decay(1, 100)).toBeGreaterThan(0)
    expect(decay(1, 0)).toBe(1)
  })
})

describe('ease', () => {
  it('starts at 0, ends at 1 and is symmetric', () => {
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
    expect(ease(0.5)).toBeCloseTo(0.5)
    expect(ease(-1)).toBe(0)
  })
})

describe('turnTo', () => {
  it('ends exactly facing the target', () => {
    const turn = turnTo([0, 0], [139.7, 35.7])
    expect(turn.at(1)).toEqual(facing([139.7, 35.7]))
  })

  it('takes the short way across the antimeridian', () => {
    // From facing 170°E to facing 170°W: 20° apart, not 340°.
    const turn = turnTo(facing([170, 0]), [-170, 0])
    const [midLon] = centerOf(turn.at(0.5))
    expect(Math.abs(midLon)).toBeGreaterThan(175)
  })

  it('takes longer for longer turns', () => {
    expect(turnTo([0, 0], [180, 0]).duration).toBeGreaterThan(turnTo([0, 0], [10, 0]).duration)
  })
})
