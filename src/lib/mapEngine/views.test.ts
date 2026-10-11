import { describe, expect, it } from 'vitest'
import { geoPath } from 'd3-geo'
import {
  clampView, coverView, flatFit, flatFrame, flatLimits, flatProjection, frameCountry, frameMarked, NO_INSET, rescaleView,
  spanWidth, unionBounds, widenBounds,
} from './views'

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

describe('frameCountry', () => {
  const world = flatProjection(MOBILE, INSET)
  const [[wx0], [wx1]] = geoPath(world).bounds({ type: 'Sphere' })
  const minWidth = spanWidth(wx1 - wx0, 30)
  const boxOf = (lon0: number, lat0: number, lon1: number, lat1: number): [[number, number], [number, number]] =>
    geoPath(world).bounds({ type: 'Polygon', coordinates: [[[lon0, lat0], [lon0, lat1], [lon1, lat1], [lon1, lat0], [lon0, lat0]]] })

  it('centres the country in the clear band between the search and the sheet', () => {
    const box = boxOf(-5, 42, 8, 51)
    const fit = frameCountry(box, MOBILE, INSET, 6, minWidth)
    const [[x0, y0], [x1, y1]] = box
    expect(fit.x + fit.k * (x0 + x1) / 2).toBeCloseTo(195)
    expect(fit.y + fit.k * (y0 + y1) / 2).toBeCloseTo((116 + 580) / 2)
  })

  it('keeps the whole country inside the clear band', () => {
    const [[x0, y0], [x1, y1]] = boxOf(-125, 25, -67, 49)
    const fit = frameCountry([[x0, y0], [x1, y1]], MOBILE, INSET, 6, minWidth)
    expect(fit.x + fit.k * x0).toBeGreaterThanOrEqual(0)
    expect(fit.x + fit.k * x1).toBeLessThanOrEqual(390)
    expect(fit.y + fit.k * y0).toBeGreaterThanOrEqual(INSET.top)
    expect(fit.y + fit.k * y1).toBeLessThanOrEqual(844 - INSET.bottom)
  })

  it('leaves room around a country rather than filling the view', () => {
    const fit = frameCountry(boxOf(-125, 25, -67, 49), MOBILE, INSET, 12, minWidth)
    const [[x0], [x1]] = boxOf(-125, 25, -67, 49)
    expect(fit.k * (x1 - x0)).toBeLessThan(390 * 0.75)
  })

  it('shows a small country with its neighbours, within the zoom cap', () => {
    // Luxembourg.
    const fit = frameCountry(boxOf(6, 49.4, 6.5, 50.2), MOBILE, INSET, 12, minWidth)
    expect(390 / fit.k).toBeGreaterThanOrEqual(minWidth)
    expect(frameCountry(boxOf(6, 49.4, 6.5, 50.2), MOBILE, INSET, 4, minWidth).k).toBe(4)
  })

  it('stays at the world view for a country as wide as the map', () => {
    expect(frameCountry(boxOf(-179, -50, 179, 70), MOBILE, INSET, 6, minWidth).k).toBe(1)
  })
})

const DESKTOP = { width: 1280, height: 720 }
const SMALL = { width: 120, height: 90 }
const MAX = 12
const CASES = [
  ['tall phone', MOBILE, INSET],
  ['tall phone without inset', MOBILE, NO_INSET],
  ['wide desktop', DESKTOP, NO_INSET],
  ['small viewport', SMALL, NO_INSET],
] as const

type Box = [[number, number], [number, number]]

/** True when the world's bounding box, drawn under `t`, covers the whole canvas. */
function covers(size: { width: number; height: number }, bounds: Box, t: { k: number; x: number; y: number }) {
  const [[x0, y0], [x1, y1]] = bounds
  const eps = 1e-6
  return t.k * x0 + t.x <= eps && t.k * x1 + t.x >= size.width - eps && t.k * y0 + t.y <= eps && t.k * y1 + t.y >= size.height - eps
}

describe('flatLimits', () => {
  it.each(CASES)('cover scale makes the world fill the %s', (_name, size, inset) => {
    const { bounds, minK } = flatLimits(size, inset, MAX)
    const [[x0, y0], [x1, y1]] = bounds
    expect(minK * (x1 - x0)).toBeGreaterThanOrEqual(size.width - 1e-6)
    expect(minK * (y1 - y0)).toBeGreaterThanOrEqual(size.height - 1e-6)
    // The smallest such scale: one axis fits exactly.
    const exact = Math.min(minK * (x1 - x0) - size.width, minK * (y1 - y0) - size.height)
    expect(exact).toBeCloseTo(0, 6)
  })

  it('starts a tall phone more zoomed in than the contain fit', () => {
    expect(flatLimits(MOBILE, INSET, MAX).minK).toBeGreaterThan(3)
  })

  it('keeps the zoom-in maximum, unless the cover scale is already past it', () => {
    expect(flatLimits(DESKTOP, NO_INSET, MAX).maxK).toBe(MAX)
    expect(flatLimits({ width: 100, height: 4000 }, NO_INSET, MAX).maxK).toBeGreaterThan(MAX)
  })
})

describe('clampView and coverView', () => {
  it.each(CASES)('the cover view covers the %s and is centred', (_name, size, inset) => {
    const limits = flatLimits(size, inset, MAX)
    const view = coverView(limits)
    expect(view.k).toBeCloseTo(limits.minK)
    expect(covers(size, limits.bounds, view)).toBe(true)
    expect(clampView(view, limits)).toEqual(view)
  })

  it.each(CASES)('keeps every clamped view covering the %s', (_name, size, inset) => {
    const limits = flatLimits(size, inset, MAX)
    for (const k of [0.1, 1, limits.minK, limits.minK * 2, 50]) {
      for (const [x, y] of [[-1e5, -1e5], [1e5, 1e5], [0, 0], [-200, 300]]) {
        const v = clampView({ k, x, y }, limits)
        expect(v.k).toBeGreaterThanOrEqual(limits.minK)
        expect(v.k).toBeLessThanOrEqual(limits.maxK)
        expect(covers(size, limits.bounds, v)).toBe(true)
      }
    }
  })

  it('cannot zoom out past the cover scale or drag the edge in', () => {
    const limits = flatLimits(MOBILE, INSET, MAX)
    expect(clampView({ k: 1, x: 0, y: 0 }, limits).k).toBeCloseTo(limits.minK)
    const dragged = clampView({ k: limits.minK * 2, x: 500, y: 500 }, limits)
    expect(dragged.x).toBeLessThanOrEqual(-dragged.k * limits.bounds[0][0] + 1e-6)
  })
})

describe('framing with limits', () => {
  it('lands exactly where the map will, never outside the clamp', () => {
    const limits = flatLimits(MOBILE, INSET, MAX)
    const [[x0, y0]] = limits.bounds
    // A country at the world's top-left corner.
    const fit = frameCountry([[x0, y0], [x0 + 20, y0 + 10]], MOBILE, INSET, 6, 0, limits)
    expect(clampView(fit, limits)).toEqual(fit)
    expect(covers(MOBILE, limits.bounds, fit)).toBe(true)
  })

  it('no marked countries is the cover view', () => {
    const limits = flatLimits(MOBILE, INSET, MAX)
    expect(frameMarked([], MOBILE, INSET, 6, 0, limits)).toEqual(coverView(limits))
  })

  it('never zooms out past the cover scale', () => {
    const limits = flatLimits(MOBILE, INSET, MAX)
    expect(flatFit([[0, 0], [1000, 1000]], MOBILE, INSET, 6, 0.85, limits).k).toBeCloseTo(limits.minK)
  })
})

describe('rescaleView', () => {
  it('keeps the relative zoom across a rotation, still covering', () => {
    const portrait = flatLimits(MOBILE, INSET, MAX)
    const landscape = flatLimits({ width: 844, height: 390 }, NO_INSET, MAX)
    const cover = rescaleView(coverView(portrait), portrait, landscape)
    expect(cover.k).toBeCloseTo(landscape.minK)
    expect(covers(landscape.size, landscape.bounds, cover)).toBe(true)
    const zoomed = rescaleView({ ...coverView(portrait), k: portrait.minK * 2 }, portrait, landscape)
    expect(zoomed.k).toBeCloseTo(landscape.minK * 2)
    expect(covers(landscape.size, landscape.bounds, zoomed)).toBe(true)
  })

  it('is the identity when the size is unchanged', () => {
    const limits = flatLimits(DESKTOP, NO_INSET, MAX)
    const view = clampView({ k: limits.minK * 3, x: -900, y: -700 }, limits)
    const back = rescaleView(view, limits, limits)
    expect(back.k).toBeCloseTo(view.k)
    expect(back.x).toBeCloseTo(view.x)
    expect(back.y).toBeCloseTo(view.y)
  })
})

describe('flatFrame (the morph) agrees with the flat map', () => {
  it('draws the cover view so the world fills the canvas', () => {
    const view = coverView(flatLimits(DESKTOP, NO_INSET, MAX))
    const { scale, translate } = flatFrame(DESKTOP, view)
    const p = flatProjection(DESKTOP)
    expect(scale).toBeCloseTo(p.scale() * view.k)
    expect(translate[0]).toBeCloseTo(p.translate()[0] * view.k + view.x)
    const [[x0, y0], [x1, y1]] = geoPath(flatProjection(DESKTOP).scale(scale).translate(translate)).bounds({ type: 'Sphere' })
    expect(x0).toBeLessThanOrEqual(1e-6)
    expect(x1).toBeGreaterThanOrEqual(DESKTOP.width - 1e-6)
    expect(y0).toBeLessThanOrEqual(1e-6)
    expect(y1).toBeGreaterThanOrEqual(DESKTOP.height - 1e-6)
  })
})
