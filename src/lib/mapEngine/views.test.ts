import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { geoBounds, geoContains, geoEqualEarth, geoEqualEarthRaw, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { SHEET_PEEK } from '../mobileSheet'
import { decodeWorld } from '../worldAtlas'
import { buildCountryIndex, countryAt, mainland, type IndexedCountry } from './countryIndex'
import { wrapLon } from './globeMotion'
import { morphRotation } from './morph'
import {
  type Bounds, type FlatLimits, type FlatView, type MapInset, type Size, clampView, coverView, coveringLongitude, DEFAULT_GLOBE,
  flatFrame, flatLimits, flatProjection, frameCountry, frameMarked, globeLon, locateAt, NO_INSET, projectionAt,
  renderTransform, rescaleView, shownShare, spanWidth, unionBounds, widenBounds, worldWidth,
} from './views'

const index = buildCountryIndex(decodeWorld(JSON.parse(
  readFileSync(new URL('../../data/world-detail.topo.json', import.meta.url), 'utf8'),
)))
const country = (name: string): IndexedCountry => {
  const c = index.find(x => x.identity.name === name)
  if (!c) throw new Error(`no ${name} in the atlas`)
  return c
}

const MOBILE = { width: 390, height: 844 }
const INSET = { top: 116, right: 0, bottom: 264, left: 0 }
const DESKTOP = { width: 1280, height: 720 }
/** The desktop map area on a 1440x900 window (the bar and the sidebar taken off). */
const MAP_AREA = { width: 1080, height: 836 }
const SMALL = { width: 120, height: 90 }
const MAX = 12
// The sheet peek covers its height less its 20px rounded corners (WorldMap's MOBILE_COVERED_BOTTOM).
const COVERED = SHEET_PEEK - 20
const CASES = [
  ['tall phone with the sheet', MOBILE, INSET, COVERED],
  ['tall phone without inset', MOBILE, NO_INSET, 0],
  ['wide desktop', DESKTOP, NO_INSET, 0],
  ['desktop map area', MAP_AREA, NO_INSET, 0],
  ['tiny viewport', SMALL, NO_INSET, 0],
] as const

const POLE = geoEqualEarthRaw(0, Math.PI / 2)[1]

/**
 * Whether the screen point (px, py) of `view` is inside the world's exact
 * Equal Earth outline, worked out from d3's raw inverse (independent of the
 * outline table the clamp uses). Turning the map leaves the outline where it
 * is, so the central meridian plays no part.
 */
function inWorld(limits: FlatLimits, view: FlatView, px: number, py: number): boolean {
  const t = renderTransform(view, limits)
  const [cx, cy] = limits.centre
  const ux = ((px - t.x) / t.k - cx) / limits.scale
  const uy = (cy - (py - t.y) / t.k) / limits.scale
  if (Math.abs(uy) > POLE) return false
  const inv = geoEqualEarthRaw.invert?.(ux, uy)
  return inv !== undefined && Math.abs(inv[0]) <= Math.PI
}

/** The share of an `n` x `n` grid over the visible canvas that shows no world. */
function bareShare(limits: FlatLimits, view: FlatView, n = 40): number {
  const { size, bottom } = limits
  let out = 0
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (!inWorld(limits, view, ((i + 0.5) / n) * size.width, ((j + 0.5) / n) * (size.height - bottom))) out++
    }
  }
  return out / (n * n)
}

/** The visible rectangle's corners, pulled `pad` px inwards. */
function corners({ size, bottom }: FlatLimits, pad = 1): [number, number][] {
  const [x0, y0, x1, y1] = [pad, pad, size.width - pad, size.height - bottom - pad]
  return [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]
}

/** Requested views across zooms, vertical pans and meridians, including the extremes. */
function requests({ minK }: FlatLimits): FlatView[] {
  const views: FlatView[] = []
  for (const k of [0.1, 1, minK * 0.9, minK, minK * 1.01, minK * 1.3, minK * 2, minK * 5, 50]) {
    for (const y of [-1e5, -1500, -100, 0, 250, 1e5]) {
      for (const lon of [-180, -37, 0, 179.9]) views.push({ k, y, lon })
    }
  }
  return views
}

/** Screen point of [lon, lat] in `view`. */
function screenOf(limits: FlatLimits, view: FlatView, point: [number, number]): [number, number] {
  const p = projectionAt(limits, view.lon)(point)
  if (!p) throw new Error('unprojectable')
  const t = renderTransform(view, limits)
  return [t.x + t.k * p[0], t.y + t.k * p[1]]
}

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

describe('coveringLongitude', () => {
  it('is the middle of one box, also across the antimeridian', () => {
    expect(coveringLongitude([[[-10, 0], [30, 1]]])).toBeCloseTo(10)
    expect(coveringLongitude([[[170, 0], [-170, 1]]])).toBeCloseTo(-180)
  })

  it('covers several boxes the short way, across the antimeridian when that is shorter', () => {
    // New Zealand, Fiji and Samoa: around 180°, not around Greenwich.
    expect(Math.abs(wrapLon(coveringLongitude([[[166, 0], [179, 1]], [[177, 0], [-178, 1]], [[-173, 0], [-171, 1]]]) ?? 0) - 180)).toBeLessThan(5)
    // Japan and the US west coast: the Pacific, not Europe.
    expect(coveringLongitude([[[129, 0], [146, 1]], [[-125, 0], [-117, 1]]])).toBeCloseTo(-174)
  })

  it('is null when the boxes leave no gap, or there are none', () => {
    expect(coveringLongitude([[[-180, 0], [180, 1]]])).toBeNull()
    expect(coveringLongitude([[[0, 0], [190, 1]], [[180, 0], [10, 1]]])).toBeNull()
    expect(coveringLongitude([])).toBeNull()
  })
})

describe('flatLimits', () => {
  it.each(CASES)('the smallest zoom just fits the %s inside the outline', (_name, size, inset, covered) => {
    const limits = flatLimits(size, inset, MAX, covered)
    const cover = coverView(limits)
    expect(cover.k).toBe(limits.minK)
    for (const [px, py] of corners(limits)) expect(inWorld(limits, cover, px, py)).toBe(true)
    // A little further out, even the centred view pokes outside the world.
    const out = { ...cover, k: limits.minK * 0.98, y: (size.height - limits.bottom) / 2 - limits.minK * 0.98 * limits.centre[1] }
    expect(corners(limits, 0).some(([px, py]) => !inWorld(limits, out, px, py))).toBe(true)
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

describe('the World view', () => {
  /** The longitudes at the canvas's left and right edges along the equator, and the latitudes at its top and bottom middle. */
  const extent = (size: Size, inset: MapInset, covered: number, lon = 0) => {
    const limits = flatLimits(size, inset, MAX, covered)
    const view = coverView(limits, lon)
    const equator = screenOf(limits, view, [lon, 0])[1]
    const at = (x: number, y: number) => locateAt(view, limits, x, y) ?? [NaN, NaN]
    return {
      west: at(0, equator)[0], east: at(size.width, equator)[0],
      north: at(size.width / 2, 0)[1], south: at(size.width / 2, size.height - limits.bottom)[1],
    }
  }

  it('shows 222° of longitude on the 1080x836 desktop map, from 80°S to 80°N down the middle', () => {
    const { west, east, north, south } = extent(MAP_AREA, NO_INSET, 0)
    expect(west).toBeCloseTo(-110.8, 1)
    expect(east).toBeCloseTo(110.8, 1)
    expect(north).toBeCloseTo(80.3, 1)
    expect(south).toBeCloseTo(-80.3, 1)
  })

  it('shows 112° of longitude on a 390x844 phone, pole to pole between the search and the sheet', () => {
    const { west, east, north, south } = extent(MOBILE, INSET, COVERED)
    expect(west).toBeCloseTo(-56.2, 1)
    expect(east).toBeCloseTo(56.2, 1)
    expect(north).toBeCloseTo(90, 1)
    expect(south).toBeCloseTo(-90, 1)
  })

  it('is the same view about any meridian, Australia whole when it is in the middle', () => {
    const { west, east } = extent(MAP_AREA, NO_INSET, 0, 134)
    expect(west).toBeCloseTo(134 - 110.8, 1)
    expect(wrapLon(east)).toBeCloseTo(wrapLon(134 + 110.8), 1)
    const limits = flatLimits(MAP_AREA, NO_INSET, MAX)
    const view = coverView(limits, 134)
    const box = geoPath(projectionAt(limits, 134)).bounds(country('Australia').feature)
    expect(shownShare(box, renderTransform(view, limits), MAP_AREA, NO_INSET)).toBeCloseTo(1, 9)
  })
})

describe('clampView', () => {
  it.each(CASES)('never shows bare canvas on the %s, at any zoom, pan or meridian', (_name, size, inset, covered) => {
    const limits = flatLimits(size, inset, MAX, covered)
    for (const t of requests(limits)) {
      const v = clampView(t, limits)
      expect(v.k).toBeGreaterThanOrEqual(limits.minK)
      expect(v.k).toBeLessThanOrEqual(limits.maxK)
      for (const [px, py] of corners(limits)) expect(inWorld(limits, v, px, py)).toBe(true)
    }
    for (const k of [limits.minK, limits.minK * 1.5, MAX]) {
      for (const y of [-1e5, 1e5]) expect(bareShare(limits, clampView({ k, y, lon: 77 }, limits))).toBe(0)
    }
  })

  it.each(CASES)('is idempotent for the %s', (_name, size, inset, covered) => {
    const limits = flatLimits(size, inset, MAX, covered)
    for (const t of requests(limits)) {
      const once = clampView(t, limits)
      expect(clampView(once, limits)).toBe(once)
    }
  })

  it('leaves the meridian (and d3\'s sideways translate) alone: sideways has no edge', () => {
    const limits = flatLimits(MAP_AREA, NO_INSET, MAX)
    for (const lon of [-180, -90, 0, 135, 179.99]) expect(clampView({ k: 0.5, y: 1e5, lon }, limits).lon).toBe(lon)
    expect(clampView({ k: 3, x: 1e7, y: 0 }, limits).x).toBe(1e7)
  })

  it.each(CASES)('leaves a view already inside the %s alone', (_name, size, inset, covered) => {
    const limits = flatLimits(size, inset, MAX, covered)
    const cover = coverView(limits, 40)
    expect(clampView(cover, limits)).toBe(cover)
    const k = limits.minK * 2
    const middle = { k, y: (size.height - limits.bottom) / 2 - k * limits.centre[1] - 5, lon: -120 }
    expect(clampView(middle, limits)).toBe(middle)
  })

  it('cannot zoom out past the smallest zoom, nor pan the pole lines into view', () => {
    const limits = flatLimits(MOBILE, INSET, MAX, COVERED)
    expect(clampView({ k: 1, y: 0, lon: 0 }, limits).k).toBeCloseTo(limits.minK)
    const down = clampView({ k: limits.minK * 2, y: 1e5, lon: 0 }, limits)
    expect(down.y + down.k * limits.bounds[0][1]).toBeCloseTo(0, 6)
  })
})

describe('the opaque bottom inset', () => {
  const limits = flatLimits(MOBILE, INSET, MAX, COVERED)

  it('lets the world bottom rise to the sheet, but not the top fall below the canvas top', () => {
    const up = clampView({ k: limits.minK * 3, y: -1e5, lon: 0 }, limits)
    expect(up.k * limits.bounds[1][1] + up.y).toBeCloseTo(MOBILE.height - COVERED, 3)
    expect(up.k * limits.bounds[1][1] + up.y).toBeGreaterThanOrEqual(MOBILE.height - SHEET_PEEK)
    const down = clampView({ k: limits.minK * 3, y: 1e5, lon: 0 }, limits)
    expect(down.k * limits.bounds[0][1] + down.y).toBeCloseTo(0, 3)
  })
})

describe('rescaleView', () => {
  it('keeps the meridian and the relative zoom across a rotation, inside the world', () => {
    const portrait = flatLimits(MOBILE, INSET, MAX, COVERED)
    const landscape = flatLimits({ width: 844, height: 390 }, NO_INSET, MAX)
    const cover = rescaleView(coverView(portrait, 150), portrait, landscape)
    expect(cover.k).toBeCloseTo(landscape.minK)
    expect(cover.lon).toBe(150)
    const zoomed = rescaleView({ ...coverView(portrait), k: portrait.minK * 2 }, portrait, landscape)
    expect(zoomed.k).toBeCloseTo(landscape.minK * 2)
    const edge = rescaleView(clampView({ k: portrait.minK * 2, y: 1e5, lon: -170 }, portrait), portrait, landscape)
    for (const v of [cover, zoomed, edge]) {
      for (const [px, py] of corners(landscape)) expect(inWorld(landscape, v, px, py)).toBe(true)
    }
  })

  it('is the identity when the size is unchanged', () => {
    const limits = flatLimits(DESKTOP, NO_INSET, MAX)
    const view = clampView({ k: limits.minK * 3, y: -700, lon: 33 }, limits)
    const back = rescaleView(view, limits, limits)
    expect(back.k).toBeCloseTo(view.k)
    expect(back.y).toBeCloseTo(view.y)
    expect(back.lon).toBe(view.lon)
  })
})

describe('the morph lands on the flat map\'s first view', () => {
  it.each([DEFAULT_GLOBE, { rotate: [-170, 10], zoom: 1 }, { rotate: [120, -60], zoom: 2 }] as const)(
    'draws the unrolled globe %j exactly where the flat map opens',
    globe => {
      const limits = flatLimits(DESKTOP, NO_INSET, MAX)
      // useFlatMap opens on coverView about the globe's meridian (WorldMap passes it); MorphMapSurface lands on the same.
      const first = clampView(coverView(limits, globeLon({ rotate: [...globe.rotate], zoom: globe.zoom })), limits)
      const frame = flatFrame(limits, first)
      const morphEnd = geoEqualEarth().scale(frame.scale).translate(frame.translate)
        .rotate(morphRotation([...globe.rotate], frame.lon, 1))
      for (const point of [[0, 0], [100, -30], [-75, 45], [179, 60], [-179, -10], [globeLon({ rotate: [...globe.rotate], zoom: 1 }), 0]] as [number, number][]) {
        const a = morphEnd(point)
        if (!a) throw new Error('unprojectable')
        const b = screenOf(limits, first, point)
        expect(a[0]).toBeCloseTo(b[0], 6)
        expect(a[1]).toBeCloseTo(b[1], 6)
      }
    },
  )

  it('turns the short way round between the globe and the flat map', () => {
    expect(morphRotation([-15, -25], 15, 0)).toEqual([-15, -25])
    // The globe faces 170°E; the flat map is centred on 170°W: 20° east, not 340° west.
    const [lambda] = morphRotation([-170, 0], -170, 0.5)
    expect(lambda).toBeCloseTo(-180)
    const end = morphRotation([-170, 10], -170, 1)
    expect(wrapLon(end[0])).toBeCloseTo(170)
    expect(end[1]).toBe(0)
    // Unrolling to the globe's own meridian does not turn at all.
    expect(morphRotation([-15, -25], globeLon(DEFAULT_GLOBE), 0.5)[0]).toBeCloseTo(-15)
  })
})

describe('framing around the antimeridian', () => {
  const VIEWPORTS = [
    ['390x844', MOBILE, INSET, COVERED],
    ['375x667', { width: 375, height: 667 }, INSET, COVERED],
    ['1280x720', DESKTOP, NO_INSET, 0],
    ['1080x836', MAP_AREA, NO_INSET, 0],
    ['1600x1000', { width: 1600, height: 1000 }, NO_INSET, 0],
  ] as const
  const STARTS = [-179, -100, 0, 60, 170]

  /** As useFlatMap focuses: the mainland, FOCUS_MAX_ZOOM 6, at least 30 degrees across. */
  const focus = (shape: GeoPermissibleObjects, size: Size, inset: MapInset, covered: number, from: number) => {
    const limits = flatLimits(size, inset, MAX, covered)
    const fit = frameCountry(shape, limits, inset, 6, spanWidth(worldWidth(limits), 30), from)
    const box: Bounds = geoPath(projectionAt(limits, fit.lon)).bounds(shape)
    return { fit, box, limits, shown: shownShare(box, renderTransform(fit, limits), size, inset) }
  }

  it.each(VIEWPORTS)('centres and shows the whole mainland of the Pacific countries on %s', (_name, size, inset, covered) => {
    for (const name of ['New Zealand', 'Fiji', 'Tonga', 'Samoa', 'Kiribati', 'Vanuatu', 'Australia']) {
      const { fit, box, limits, shown } = focus(mainland(country(name)), size, inset, covered, 0)
      expect(fit.k, name).toBeLessThanOrEqual(6)
      expect(shown, name).toBeCloseTo(1, 6)
      expect(clampView(fit, limits), name).toBe(fit)
      // Centred sideways, to a fraction of a pixel.
      const t = renderTransform(fit, limits)
      expect(t.x + fit.k * (box[0][0] + box[1][0]) / 2, name).toBeCloseTo(size.width / 2, 0)
    }
  })

  it('frames New Zealand at 6x on every desktop (it no longer has to sit off-centre)', () => {
    for (const size of [DESKTOP, MAP_AREA, { width: 1600, height: 1000 }]) {
      expect(focus(mainland(country('New Zealand')), size, NO_INSET, 0, 0).fit.k).toBeCloseTo(6)
    }
  })

  it('lands on the same view whichever way the map was turned, and turns less than half a world to get there', () => {
    for (const name of ['New Zealand', 'Fiji', 'Kiribati', 'Russia', 'United States of America', 'Australia']) {
      const shape = mainland(country(name))
      const targets = STARTS.map(from => focus(shape, MAP_AREA, NO_INSET, 0, from).fit)
      for (const [i, fit] of targets.entries()) {
        expect(fit.lon, name).toBeCloseTo(targets[0].lon, 9)
        expect(fit.k, name).toBeCloseTo(targets[0].k, 9)
        // useFlatMap's animation turns by wrapLon(target - from): the short way.
        expect(Math.abs(wrapLon(fit.lon - STARTS[i])), name).toBeLessThanOrEqual(180)
      }
    }
    // From 170°E to Fiji (178°E) is 8° east, from 179°W it is 3° west: never the long way round.
    const fiji = focus(mainland(country('Fiji')), MAP_AREA, NO_INSET, 0, 170).fit.lon
    expect(wrapLon(fiji - 170)).toBeGreaterThan(0)
    expect(wrapLon(fiji - 170)).toBeLessThan(15)
    expect(wrapLon(fiji - -179)).toBeLessThan(0)
    expect(wrapLon(fiji - -179)).toBeGreaterThan(-15)
  })

  it('shows countries that cross the antimeridian whole on desktop: Russia, Fiji, the USA with Alaska, NZ with the Chatham Islands, Kiribati', () => {
    for (const name of ['Russia', 'Fiji', 'United States of America', 'New Zealand', 'Kiribati']) {
      for (const size of [DESKTOP, MAP_AREA]) {
        const limits = flatLimits(size, NO_INSET, MAX)
        // "Fit to my countries" with only this one marked: its whole shape, every part.
        const fit = frameMarked([country(name).feature], limits, NO_INSET, 6, 0, -40)
        const box = geoPath(projectionAt(limits, fit.lon)).bounds(country(name).feature)
        // Not cut in two by the antimeridian: no wider than half the world.
        expect(box[1][0] - box[0][0], name).toBeLessThan(worldWidth(limits) / 2)
        expect(shownShare(box, renderTransform(fit, limits), size, NO_INSET), name).toBeCloseTo(1, 6)
        expect(clampView(fit, limits)).toBe(fit)
      }
    }
  })

  it('frames Russia\'s mainland whole on desktop, centred on it', () => {
    const { fit, shown } = focus(mainland(country('Russia')), MAP_AREA, NO_INSET, 0, -100)
    expect(shown).toBeCloseTo(1, 6)
    expect(fit.lon).toBeGreaterThan(90)
    expect(fit.lon).toBeLessThan(110)
  })

  it('leaves the far north on a phone as the strict top edge allows', () => {
    // The top edge stays at the canvas top, so on a phone these sit under the search band at any zoom:
    // the fit keeps its zoom rather than zooming out for nothing (a product decision from #56).
    for (const name of ['Iceland', 'Norway', 'Greenland']) {
      const { fit, shown, limits } = focus(mainland(country(name)), MOBILE, INSET, COVERED, 0)
      expect(fit.k, name).toBeCloseTo(6)
      expect(shown, name).toBeLessThan(0.05)
      expect(clampView(fit, limits), name).toBe(fit)
    }
  })

  it('frames Chile in the middle of the clear band on a phone', () => {
    const { fit, box, limits } = focus(mainland(country('Chile')), MOBILE, INSET, COVERED, 0)
    const t = renderTransform(fit, limits)
    expect(t.y + fit.k * box[0][1]).toBeGreaterThanOrEqual(INSET.top - 1e-6)
    expect(t.y + fit.k * box[1][1]).toBeLessThanOrEqual(MOBILE.height - INSET.bottom + 1e-6)
  })
})

describe('frameMarked', () => {
  const limits = flatLimits(MOBILE, INSET, MAX, COVERED)
  const box = (lon0: number, lat0: number, lon1: number, lat1: number): GeoPermissibleObjects =>
    ({ type: 'Polygon', coordinates: [[[lon0, lat0], [lon0, lat1], [lon1, lat1], [lon1, lat0], [lon0, lat0]]] })

  it('is the World view about the current meridian with nothing marked', () => {
    expect(frameMarked([], limits, INSET, 6, 0, 120)).toEqual(coverView(limits, 120))
  })

  it('frames a Europe-only account on Europe, in the middle of the desktop map', () => {
    const europe = box(-10, 36, 30, 60)
    const desktop = flatLimits(MAP_AREA, NO_INSET, MAX)
    const fit = frameMarked([europe], desktop, NO_INSET, 6, spanWidth(worldWidth(desktop), 60), 150)
    expect(fit.k).toBeGreaterThan(desktop.minK)
    expect(fit.lon).toBeGreaterThan(5)
    expect(fit.lon).toBeLessThan(15)
    const [[x0, y0], [x1, y1]] = geoPath(projectionAt(desktop, fit.lon)).bounds(europe)
    const t = renderTransform(fit, desktop)
    expect(t.x + fit.k * (x0 + x1) / 2).toBeCloseTo(MAP_AREA.width / 2, 1)
    expect(t.y + fit.k * (y0 + y1) / 2).toBeCloseTo(MAP_AREA.height / 2, 1)
  })

  it('frames Europe on a phone as low as the strict top edge lets it sit', () => {
    const europe = box(-10, 36, 30, 60)
    const fit = frameMarked([europe], limits, INSET, 6, spanWidth(worldWidth(limits), 60))
    const t = renderTransform(fit, limits)
    // The world's top (the pole line) stays at the canvas top.
    expect(t.y + fit.k * limits.bounds[0][1]).toBeCloseTo(0, 6)
    expect(clampView(fit, limits)).toBe(fit)
  })

  it('keeps a single small country to about a continent across', () => {
    const minWidth = spanWidth(worldWidth(limits), 60)
    const fit = frameMarked([box(6, 49.4, 6.5, 50.2)], limits, INSET, 12, minWidth)
    expect(390 / fit.k).toBeGreaterThanOrEqual(minWidth * 0.85 - 1e-6)
    expect(fit.k).toBeLessThan(6)
    expect(frameMarked([box(6, 49.4, 6.5, 50.2)], limits, INSET, 12).k).toBe(12)
  })

  it('frames Japan and California across the Pacific, not the long way round over Europe', () => {
    const desktop = flatLimits(MAP_AREA, NO_INSET, MAX)
    const fit = frameMarked([box(129, 31, 146, 45), box(-125, 32, -114, 42)], desktop, NO_INSET, 6)
    expect(Math.abs(wrapLon(fit.lon - -174))).toBeLessThan(10)
    for (const b of [box(129, 31, 146, 45), box(-125, 32, -114, 42)]) {
      const bounds = geoPath(projectionAt(desktop, fit.lon)).bounds(b)
      expect(shownShare(bounds, renderTransform(fit, desktop), MAP_AREA, NO_INSET)).toBeCloseTo(1, 6)
    }
  })
})

describe('hit-testing across the antimeridian', () => {
  /** The country under the screen point of [lon, lat] in `view`. */
  const pick = (limits: FlatLimits, view: FlatView, point: [number, number]) => {
    const [x, y] = screenOf(limits, view, point)
    const lonLat = locateAt(view, limits, x, y)
    return lonLat && countryAt(index, lonLat)?.identity.name
  }

  /** A point inside one of `name`'s polygons on the east (lon > 0) or west (lon < 0) side of 180°, from the atlas itself. */
  const inside = (name: string, east: boolean): [number, number] => {
    const g = country(name).feature.geometry
    const polygons = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : []
    for (const coordinates of polygons) {
      const polygon = { type: 'Polygon' as const, coordinates }
      const [[west, south], [eastEdge, north]] = geoBounds(polygon)
      if (west > eastEdge || (east ? west < 90 : eastEdge > -90)) continue
      // Scan the polygon's box for a point inside it (centroids of thin islands can fall in the sea).
      for (let i = 1; i < 20; i++) {
        for (let j = 1; j < 20; j++) {
          const p: [number, number] = [west + (eastEdge - west) * i / 20, south + (north - south) * j / 20]
          if (geoContains(polygon, p)) return p
        }
      }
    }
    throw new Error(`no ${east ? 'eastern' : 'western'} part of ${name}`)
  }

  it.each([180, -178, 175, 0])('finds the countries either side of 180° on a map centred on %s°', lon => {
    for (const [size, inset, covered] of [[MAP_AREA, NO_INSET, 0], [MOBILE, INSET, COVERED]] as const) {
      const limits = flatLimits(size, inset, MAX, covered)
      const view = clampView({ k: 6, y: 0, lon }, limits)
      // Fiji and Russia (Chukotka) have land either side of 180°.
      for (const name of ['Fiji', 'Russia']) {
        expect(pick(limits, view, inside(name, true)), name).toBe(name)
        expect(pick(limits, view, inside(name, false)), name).toBe(name)
      }
      expect(pick(limits, view, inside('United States of America', false))).toBe('United States of America')
      // And a point maps back to itself wherever it lands on screen.
      const back = locateAt(view, limits, ...screenOf(limits, view, [-179.5, 10]))
      expect(wrapLon(back?.[0] ?? NaN)).toBeCloseTo(-179.5, 6)
    }
  })
})
