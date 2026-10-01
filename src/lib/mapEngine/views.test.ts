import { describe, expect, it } from 'vitest'
import { geoPath } from 'd3-geo'
import { flatFit, flatProjection, frameMarked, NO_INSET, spanWidth, unionBounds, widenBounds } from './views'

const MOBILE = { width: 390, height: 844 }
const INSET = { top: 116, right: 0, bottom: 264, left: 0 }

describe('flatProjection with an inset', () => {
  it('fits the world inside the inset area, filling its width', () => {
    const [[x0, y0], [x1, y1]] = geoPath(flatProjection(MOBILE, INSET)).bounds({ type: 'Sphere' })
    expect(x0).toBeGreaterThanOrEqual(0)
    expect(x1).toBeLessThanOrEqual(390)
    expect(x1 - x0).toBeGreaterThan(370)
    expect(y0).toBeGreaterThanOrEqual(INSET.top)
    expect(y1).toBeLessThanOrEqual(844 - INSET.bottom)
    // Centred in the clear band, not the whole screen.
    expect((y0 + y1) / 2).toBeCloseTo((INSET.top + 844 - INSET.bottom) / 2, 0)
  })

  it('ignores an inset that leaves no room', () => {
    const tiny = flatProjection({ width: 100, height: 100 }, { top: 90, right: 0, bottom: 0, left: 0 })
    const full = flatProjection({ width: 100, height: 100 })
    expect(tiny.scale()).toBeCloseTo(full.scale())
  })
})

describe('flatFit', () => {
  it('centres the bounds in the inset area', () => {
    const fit = flatFit([[100, 400], [140, 420]], MOBILE, INSET, 6)
    expect(fit.k).toBe(6)
    const cx = fit.x + fit.k * 120
    const cy = fit.y + fit.k * 410
    expect(cx).toBeCloseTo(195)
    expect(cy).toBeCloseTo((116 + 580) / 2)
  })

  it('never zooms out past the whole map', () => {
    expect(flatFit([[0, 0], [1000, 1000]], MOBILE, NO_INSET, 6).k).toBe(1)
  })
})

describe('unionBounds', () => {
  it('covers every box', () => {
    expect(unionBounds([[[10, 20], [30, 40]], [[5, 25], [15, 60]]])).toEqual([[5, 20], [30, 60]])
  })

  it('is null for no boxes', () => {
    expect(unionBounds([])).toBeNull()
  })
})

describe('widenBounds', () => {
  it('grows narrow bounds about their centre', () => {
    expect(widenBounds([[100, 10], [110, 20]], 50)).toEqual([[80, 10], [130, 20]])
  })

  it('leaves wide enough bounds alone', () => {
    expect(widenBounds([[0, 0], [80, 20]], 50)).toEqual([[0, 0], [80, 20]])
  })
})

describe('spanWidth', () => {
  it('is the share of the world width', () => {
    expect(spanWidth(360, 60)).toBe(60)
    expect(spanWidth(720, 90)).toBe(180)
  })

  it('clamps to the whole world', () => {
    expect(spanWidth(360, 720)).toBe(360)
    expect(spanWidth(360, -5)).toBe(0)
  })
})

describe('frameMarked', () => {
  const world = flatProjection(MOBILE, INSET)
  const [[wx0], [wx1]] = geoPath(world).bounds({ type: 'Sphere' })
  const worldWidth = wx1 - wx0
  const boxOf = (lon0: number, lat0: number, lon1: number, lat1: number): [[number, number], [number, number]] =>
    geoPath(world).bounds({ type: 'Polygon', coordinates: [[[lon0, lat0], [lon0, lat1], [lon1, lat1], [lon1, lat0], [lon0, lat0]]] })

  it('is the world view with nothing marked', () => {
    expect(frameMarked([], MOBILE, INSET, 6, spanWidth(worldWidth, 60))).toEqual({ k: 1, x: 0, y: 0 })
  })

  it('zooms a portrait phone well past the world for countries across several continents', () => {
    // Europe, Asia and the Americas.
    const fit = frameMarked([boxOf(-10, 36, 30, 60), boxOf(100, 20, 140, 45), boxOf(-120, -35, -60, 50)], MOBILE, INSET, 6)
    expect(fit.k).toBeGreaterThan(1)
    expect(fit.k).toBeLessThan(2)
  })

  it('frames a Europe-only account on Europe', () => {
    const fit = frameMarked([boxOf(-10, 36, 30, 60)], MOBILE, INSET, 6, spanWidth(worldWidth, 60))
    expect(fit.k).toBeGreaterThan(3)
    // The middle of Europe lands in the middle of the clear band.
    const [[x0, y0], [x1, y1]] = boxOf(-10, 36, 30, 60)
    expect(fit.x + fit.k * (x0 + x1) / 2).toBeCloseTo(195)
    expect(fit.y + fit.k * (y0 + y1) / 2).toBeCloseTo((116 + 580) / 2)
  })

  it('keeps a single small country to about a continent across', () => {
    const minWidth = spanWidth(worldWidth, 60)
    const fit = frameMarked([boxOf(6, 49.4, 6.5, 50.2)], MOBILE, INSET, 12, minWidth)
    // The visible band spans at least the minimum width (less the fit padding).
    expect(390 / fit.k).toBeGreaterThanOrEqual(minWidth)
    expect(fit.k).toBeLessThan(6)
    // Without the minimum it would hit the zoom cap.
    expect(frameMarked([boxOf(6, 49.4, 6.5, 50.2)], MOBILE, INSET, 12).k).toBe(12)
  })
})
