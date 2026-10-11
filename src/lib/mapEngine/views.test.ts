import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SHEET_PEEK } from '../mobileSheet'
import { decodeWorld } from '../worldAtlas'
import { buildCountryIndex, mainland } from './countryIndex'
import { geoEqualEarthRaw, geoPath } from 'd3-geo'
import {
  type Bounds, type FlatLimits, type MapInset, type Size, clampView, coverView, flatFit, flatFrame, flatLimits, flatProjection, frameCountry, frameMarked, NO_INSET, PAN_SLACK, rescaleView,
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
// The sheet peek covers its height less its 20px rounded corners (WorldMap's MOBILE_COVERED_BOTTOM).
const COVERED = SHEET_PEEK - 20
const CASES = [
  ['tall phone with the sheet', MOBILE, INSET, COVERED],
  ['tall phone without inset', MOBILE, NO_INSET, 0],
  ['wide desktop', DESKTOP, NO_INSET, 0],
  ['tiny viewport', SMALL, NO_INSET, 0],
] as const

type View = { k: number; x: number; y: number }
const POLE = geoEqualEarthRaw(0, Math.PI / 2)[1]

/**
 * Whether the screen point (px, py) under view `t` is inside the world's
 * exact Equal Earth outline, worked out from d3's own projection and its raw
 * inverse (independent of the outline table the clamp uses).
 */
function inWorld(size: Size, inset: MapInset, t: View, px: number, py: number): boolean {
  const p = flatProjection(size, inset)
  const [cx, cy] = p.translate()
  const ux = ((px - t.x) / t.k - cx) / p.scale()
  const uy = (cy - (py - t.y) / t.k) / p.scale()
  if (Math.abs(uy) > POLE) return false
  const inv = geoEqualEarthRaw.invert?.(ux, uy)
  return inv !== undefined && Math.abs(inv[0]) <= Math.PI
}

/** The exact outline's half-width (outline units) at height v, by bisection on the ±180° meridian. */
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

/**
 * How far (screen px, sideways) the point (px, py) under view `t` lies past
 * the world's exact outline: 0 inside it, Infinity past a pole line.
 */
function excess(size: Size, inset: MapInset, t: View, px: number, py: number): number {
  const p = flatProjection(size, inset)
  const [cx, cy] = p.translate()
  const ux = ((px - t.x) / t.k - cx) / p.scale()
  const uy = (cy - (py - t.y) / t.k) / p.scale()
  if (Math.abs(uy) > POLE + 1e-9) return Infinity
  return Math.max(0, (Math.abs(ux) - exactHalfWidth(Math.abs(uy))) * p.scale() * t.k)
}

/** Within the pan slack: no further past the outline than `PAN_SLACK.cap` (plus the 1px tolerance). */
const MAX_WEDGE = PAN_SLACK.cap + 1

/** The visible rectangle's corners, pulled `pad` px inwards (the 1px tolerance). */
function corners({ size, bottom }: FlatLimits, pad = 1): [number, number][] {
  const [x0, y0, x1, y1] = [pad, pad, size.width - pad, size.height - bottom - pad]
  return [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]
}

/**
 * Bare canvas in the visible area under `t`, sampled on an `n` x `n` grid:
 * the share of samples outside the exact outline, and the widest stretch of
 * a sampled row past it (px).
 */
function bareCanvas(limits: FlatLimits, inset: MapInset, t: View, n = 60): { share: number; widest: number } {
  const { size, bottom } = limits
  let out = 0
  let widest = 0
  for (let j = 0; j < n; j++) {
    const py = ((j + 0.5) / n) * (size.height - bottom)
    let row = 0
    for (let i = 0; i < n; i++) {
      if (!inWorld(size, inset, t, ((i + 0.5) / n) * size.width, py)) row++
    }
    out += row
    // The outline is convex, so a row's bare canvas is at its ends: measure it there exactly.
    if (row) widest = Math.max(widest, excess(size, inset, t, 0, py), excess(size, inset, t, size.width, py))
  }
  return { share: out / (n * n), widest }
}

/** Requested transforms across zooms and pans, including the extremes. */
function requests({ minK }: FlatLimits): View[] {
  const views: View[] = []
  for (const k of [0.1, 1, minK * 0.9, minK, minK * 1.01, minK * 1.3, minK * 2, minK * 5, 50]) {
    for (const x of [-1e5, -2000, -200, 0, 300, 1e5]) {
      for (const y of [-1e5, -1500, -100, 0, 250, 1e5]) views.push({ k, x, y })
    }
  }
  return views
}

describe('flatLimits', () => {
  it.each(CASES)('the smallest zoom just fits the %s inside the outline', (_name, size, inset, covered) => {
    const limits = flatLimits(size, inset, MAX, covered)
    const cover = coverView(limits)
    expect(cover.k).toBe(limits.minK)
    for (const [px, py] of corners(limits)) expect(inWorld(size, inset, cover, px, py)).toBe(true)
    // A little further out, even the centred view pokes outside the world.
    const out = { k: limits.minK * 0.98, x: 0, y: 0 }
    const [cx, cy] = flatProjection(size, inset).translate()
    out.x = size.width / 2 - out.k * cx
    out.y = (size.height - limits.bottom) / 2 - out.k * cy
    expect(corners(limits, 0).some(([px, py]) => !inWorld(size, inset, out, px, py))).toBe(true)
  })

  it.each(CASES)('is never looser than the bounding-box cover scale for the %s', (_name, size, inset, covered) => {
    const { bounds: [[x0, y0], [x1, y1]], bottom, minK } = flatLimits(size, inset, MAX, covered)
    expect(minK).toBeGreaterThanOrEqual(Math.max(size.width / (x1 - x0), (size.height - bottom) / (y1 - y0)) - 1e-9)
  })

  it('starts a tall phone more zoomed in than the contain fit', () => {
    expect(flatLimits(MOBILE, INSET, MAX, COVERED).minK).toBeGreaterThan(3)
  })

  it('keeps the zoom-in maximum, unless the smallest zoom is already past it', () => {
    expect(flatLimits(DESKTOP, NO_INSET, MAX).maxK).toBe(MAX)
    expect(flatLimits({ width: 100, height: 4000 }, NO_INSET, MAX).maxK).toBeGreaterThan(MAX)
  })

  it('does not relax the bottom without an inset', () => {
    expect(flatLimits(MOBILE, NO_INSET, MAX).bottom).toBe(0)
  })
})

describe('clampView', () => {
  it.each(CASES)('keeps every visible corner of the %s within the slack of the outline', (_name, size, inset, covered) => {
    const limits = flatLimits(size, inset, MAX, covered)
    for (const t of requests(limits)) {
      const v = clampView(t, limits)
      expect(v.k).toBeGreaterThanOrEqual(limits.minK)
      expect(v.k).toBeLessThanOrEqual(limits.maxK)
      for (const [px, py] of corners(limits)) expect(excess(size, inset, v, px, py)).toBeLessThanOrEqual(MAX_WEDGE)
      // Zoomed right out there is no slack: the whole canvas is inside.
      if (v.k === limits.minK) for (const [px, py] of corners(limits)) expect(inWorld(size, inset, v, px, py)).toBe(true)
    }
  })

  it.each(CASES)('is idempotent for the %s', (_name, size, inset, covered) => {
    const limits = flatLimits(size, inset, MAX, covered)
    for (const t of requests(limits)) {
      const once = clampView(t, limits)
      expect(clampView(once, limits)).toEqual(once)
    }
  })

  it.each(CASES)('shows at most a thin wedge of bare canvas at the extreme pans of the %s', (_name, size, inset, covered) => {
    const limits = flatLimits(size, inset, MAX, covered)
    expect(bareCanvas(limits, inset, coverView(limits)).share).toBe(0)
    let most = 0
    for (const k of [limits.minK, limits.minK * 1.2, limits.minK * 1.5, limits.minK * 3, 6, MAX]) {
      for (const x of [-1e5, 0, 1e5]) {
        for (const y of [-1e5, 0, 1e5]) {
          const { share, widest } = bareCanvas(limits, inset, clampView({ k, x, y }, limits))
          // Only sideways wedges, never wider than the slack's cap.
          expect(widest).toBeLessThanOrEqual(MAX_WEDGE)
          if (k <= limits.minK) expect(share).toBe(0)
          most = Math.max(most, share)
        }
      }
    }
    // The slack is used: a pan to an edge does show some canvas past the outline.
    expect(most).toBeGreaterThan(0)
    expect(most).toBeLessThan(PAN_SLACK.cap / size.width)
  })

  it.each(CASES)('leaves a view already inside the %s alone', (_name, size, inset, covered) => {
    const limits = flatLimits(size, inset, MAX, covered)
    expect(clampView(coverView(limits), limits)).toEqual(coverView(limits))
    // Zoomed in on the middle of the map: nowhere near an edge.
    const k = limits.minK * 2
    const [cx, cy] = flatProjection(size, inset).translate()
    const middle = { k, x: size.width / 2 - k * cx + 10, y: size.height / 2 - k * cy - 5 }
    expect(clampView(middle, limits)).toEqual(middle)
  })

  it('cannot zoom out past the smallest zoom or drag the edge in', () => {
    const limits = flatLimits(MOBILE, INSET, MAX, COVERED)
    expect(clampView({ k: 1, x: 0, y: 0 }, limits).k).toBeCloseTo(limits.minK)
    const dragged = clampView({ k: limits.minK * 2, x: 500, y: 500 }, limits)
    expect(dragged.x).toBeLessThanOrEqual(-dragged.k * limits.bounds[0][0] + PAN_SLACK.side + 1e-6)
    expect(excess(MOBILE, INSET, dragged, 0, 0)).toBeLessThanOrEqual(MAX_WEDGE)
  })

  it('pulls in a corner wedge the old bounding-box clamp allowed', () => {
    // Panned to the far east at a modest zoom: the old box clamp left the top-right corner far outside the curve.
    const limits = flatLimits(MOBILE, INSET, MAX, COVERED)
    const k = limits.minK * 1.5
    const [[, y0], [x1]] = limits.bounds
    const boxEdge = { k, x: MOBILE.width - k * x1, y: -k * y0 }
    expect(excess(MOBILE, INSET, boxEdge, MOBILE.width - 1, 1)).toBeGreaterThan(MAX_WEDGE)
    const v = clampView(boxEdge, limits)
    expect(excess(MOBILE, INSET, v, MOBILE.width - 1, 1)).toBeLessThanOrEqual(MAX_WEDGE)
  })

  it('has no slack at the World view zoom, so zooming right out is wholly inside the outline', () => {
    const limits = flatLimits(MOBILE, INSET, MAX, COVERED)
    for (const x of [-1e5, 1e5]) {
      const v = clampView({ k: limits.minK, x, y: 0 }, limits)
      for (const [px, py] of corners(limits)) expect(inWorld(MOBILE, INSET, v, px, py)).toBe(true)
    }
  })
})

describe('framing with limits', () => {
  const world = flatProjection(MOBILE, INSET)
  const boxOf = (lon0: number, lat0: number, lon1: number, lat1: number): Bounds =>
    geoPath(world).bounds({ type: 'Polygon', coordinates: [[[lon0, lat0], [lon0, lat1], [lon1, lat1], [lon1, lat0], [lon0, lat0]]] })

  it('lands exactly where the map will, never outside the clamp', () => {
    const limits = flatLimits(MOBILE, INSET, MAX, COVERED)
    const [[x0, y0]] = limits.bounds
    // A box at the world's top-left corner, and real countries near the edges.
    const boxes = [[[x0, y0], [x0 + 20, y0 + 10]] as Bounds, boxOf(166, -47, 179, -34), boxOf(-25, 63, -13, 67), boxOf(-180, 50, -130, 72)]
    for (const box of boxes) {
      const fit = frameCountry(box, MOBILE, INSET, 6, 0, limits)
      expect(clampView(fit, limits)).toEqual(fit)
      for (const [px, py] of corners(limits)) expect(excess(MOBILE, INSET, fit, px, py)).toBeLessThanOrEqual(MAX_WEDGE)
      const marked = frameMarked([box], MOBILE, INSET, 6, 0, limits)
      expect(clampView(marked, limits)).toEqual(marked)
    }
    const fit = flatFit(boxOf(100, -10, 150, 20), DESKTOP, NO_INSET, 6, 0.85, flatLimits(DESKTOP, NO_INSET, MAX))
    expect(clampView(fit, flatLimits(DESKTOP, NO_INSET, MAX))).toEqual(fit)
  })

  it('no marked countries is the cover view', () => {
    const limits = flatLimits(MOBILE, INSET, MAX, COVERED)
    expect(frameMarked([], MOBILE, INSET, 6, 0, limits)).toEqual(coverView(limits))
  })

  it('never zooms out past the smallest zoom', () => {
    const limits = flatLimits(MOBILE, INSET, MAX, COVERED)
    expect(flatFit(limits.bounds, MOBILE, INSET, 6, 0.85, limits)).toEqual(coverView(limits))
  })
})

describe('rescaleView', () => {
  it('keeps the relative zoom across a rotation, still within the slack of the outline', () => {
    const portrait = flatLimits(MOBILE, INSET, MAX, COVERED)
    const landscape = flatLimits({ width: 844, height: 390 }, NO_INSET, MAX)
    const cover = rescaleView(coverView(portrait), portrait, landscape)
    expect(cover.k).toBeCloseTo(landscape.minK)
    const zoomed = rescaleView({ ...coverView(portrait), k: portrait.minK * 2 }, portrait, landscape)
    expect(zoomed.k).toBeCloseTo(landscape.minK * 2)
    // Panned to an edge before the rotation, too.
    const edge = rescaleView(clampView({ k: portrait.minK * 2, x: -1e5, y: 1e5 }, portrait), portrait, landscape)
    for (const v of [cover, zoomed, edge]) {
      for (const [px, py] of corners(landscape)) expect(excess({ width: 844, height: 390 }, NO_INSET, v, px, py)).toBeLessThanOrEqual(MAX_WEDGE)
    }
    for (const [px, py] of corners(landscape)) expect(inWorld({ width: 844, height: 390 }, NO_INSET, cover, px, py)).toBe(true)
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
  it('draws the cover view with the whole canvas inside the world', () => {
    const view = coverView(flatLimits(DESKTOP, NO_INSET, MAX))
    const { scale, translate } = flatFrame(DESKTOP, view)
    const p = flatProjection(DESKTOP)
    expect(scale).toBeCloseTo(p.scale() * view.k)
    expect(translate[0]).toBeCloseTo(p.translate()[0] * view.k + view.x)
    expect(translate[1]).toBeCloseTo(p.translate()[1] * view.k + view.y)
    // The morph's projection at that frame, checked straight against the raw outline.
    for (const [px, py] of [[1, 1], [DESKTOP.width - 1, 1], [1, DESKTOP.height - 1], [DESKTOP.width - 1, DESKTOP.height - 1]]) {
      const inv = geoEqualEarthRaw.invert?.((px - translate[0]) / scale, (translate[1] - py) / scale)
      expect(inv && Math.abs(inv[0]) <= Math.PI && Math.abs(inv[1]) <= Math.PI / 2).toBe(true)
    }
  })
})

describe('the opaque bottom inset', () => {
  const limits = flatLimits(MOBILE, INSET, MAX, COVERED)
  /** Screen y of a country's centre, and of its box's top, when focused (FOCUS_MAX_ZOOM 6, 30 degrees across). */
  const framed = (lon: number, lat: number, dLon: number, dLat: number) => {
    const p = flatProjection(MOBILE, INSET)
    const [a, b] = [p([lon - dLon / 2, lat - dLat / 2]), p([lon + dLon / 2, lat + dLat / 2])] as [[number, number], [number, number]]
    const bounds: Bounds = [[Math.min(a[0], b[0]), Math.min(a[1], b[1])], [Math.max(a[0], b[0]), Math.max(a[1], b[1])]]
    const fit = frameCountry(widenBounds(bounds, spanWidth(limits.bounds[1][0] - limits.bounds[0][0], 30)), MOBILE, INSET, 6, 0, limits)
    const c = p([lon, lat]) as [number, number]
    return { x: c[0] * fit.k + fit.x, y: c[1] * fit.k + fit.y, top: bounds[0][1] * fit.k + fit.y, bottom: bounds[1][1] * fit.k + fit.y }
  }

  it('lets the world bottom rise to the sheet, but not the top fall below the canvas top', () => {
    const view = clampView({ k: limits.minK * 3, x: 0, y: -1e5 }, limits)
    expect(view.k * limits.bounds[1][1] + view.y).toBeCloseTo(MOBILE.height - COVERED, 3)
    expect(view.k * limits.bounds[1][1] + view.y).toBeGreaterThanOrEqual(MOBILE.height - SHEET_PEEK)
    const down = clampView({ k: limits.minK * 3, x: 0, y: 1e5 }, limits)
    expect(down.k * limits.bounds[0][1] + down.y).toBeCloseTo(0, 3)
  })

  it('frames Chile in the middle of the clear band', () => {
    const { x, y } = framed(-71, -36, 10, 38)
    // Not pushed sideways (the bounds' centre is mid-screen; Chile's own centre is 13px off it).
    expect(Math.abs(x - MOBILE.width / 2)).toBeLessThan(20)
    expect(y).toBeGreaterThan(INSET.top)
    expect(y).toBeLessThan(MOBILE.height - SHEET_PEEK)
  })

  it('frames Iceland and Norway no higher than the bounding-box clamp did', () => {
    // Their centres sit just under the search band by design (the world's top edge stays at the canvas top).
    for (const [lon, lat, dLon, dLat] of [[-19, 65, 12, 5], [15, 65, 26, 13]]) {
      const { y } = framed(lon, lat, dLon, dLat)
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(MOBILE.height - SHEET_PEEK)
    }
  })
})

describe('focusing the Pacific edge countries (the pan slack)', () => {
  const index = buildCountryIndex(decodeWorld(JSON.parse(
    readFileSync(new URL('../../data/world-detail.topo.json', import.meta.url), 'utf8'),
  )))
  const VIEWPORTS = [
    ['390x844', MOBILE, INSET, COVERED, SHEET_PEEK],
    ['375x667', { width: 375, height: 667 }, INSET, COVERED, SHEET_PEEK],
    ['1280x720', DESKTOP, NO_INSET, 0, 0],
  ] as const

  // As useFlatMap focuses: the mainland's bounds, FOCUS_MAX_ZOOM 6, at least 30 degrees across.
  it.each(VIEWPORTS)('centres them in the clear band on %s, at most 6x', (_name, size, inset, covered, sheet) => {
    const p = flatProjection(size, inset)
    const limits = flatLimits(size, inset, MAX, covered)
    const minWidth = spanWidth(limits.bounds[1][0] - limits.bounds[0][0], 30)
    for (const name of ['New Zealand', 'Fiji', 'Tonga', 'Samoa', 'Kiribati', 'Vanuatu']) {
      const country = index.find(c => c.identity.name === name)
      expect(country, name).toBeDefined()
      if (!country) continue
      const [[x0, y0], [x1, y1]] = geoPath(p).bounds(mainland(country))
      const fit = frameCountry([[x0, y0], [x1, y1]], size, inset, 6, minWidth, limits)
      const [x, y] = [fit.x + fit.k * (x0 + x1) / 2, fit.y + fit.k * (y0 + y1) / 2]
      expect(fit.k, name).toBeLessThanOrEqual(6)
      expect(x, name).toBeGreaterThanOrEqual(40)
      expect(x, name).toBeLessThanOrEqual(size.width - 40)
      expect(y, name).toBeGreaterThanOrEqual(inset.top)
      expect(y, name).toBeLessThanOrEqual(size.height - sheet)
    }
  })
})
