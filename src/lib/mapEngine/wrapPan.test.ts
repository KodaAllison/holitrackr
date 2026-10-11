import { describe, expect, it } from 'vitest'
import type { ViewTransform } from './renderer'
import { clampView, flatLimits, locateAt, NO_INSET, projectionAt, renderTransform, type FlatLimits, type FlatView } from './views'
import { panLongitude, zoomRow } from './wrapPan'

const SIZE = { width: 1080, height: 836 }
const limits = flatLimits(SIZE, NO_INSET, 12)
const INSET = { top: 116, right: 0, bottom: 264, left: 0 }
const phone = flatLimits({ width: 390, height: 844 }, INSET, 12, 236)

/** Screen point of [lon, lat] in `view`. */
function screenOf(l: FlatLimits, view: FlatView, point: [number, number]): [number, number] {
  const p = projectionAt(l, view.lon)(point)
  if (!p) throw new Error('unprojectable')
  const t = renderTransform(view, l)
  return [t.x + t.k * p[0], t.y + t.k * p[1]]
}

/**
 * A d3-zoom gesture as the flat map sees it: d3's affine transform changes
 * (here as d3 computes it), the map reads the change as a turn, and `view`
 * is what gets drawn.
 */
class Gesture {
  affine: ViewTransform
  view: FlatView
  constructor(readonly l: FlatLimits, start: FlatView) {
    this.view = start
    // d3's x starts anywhere (it runs free); begin away from the canonical one to show it does not matter.
    this.affine = { ...renderTransform(start, l), x: renderTransform(start, l).x + 12345 }
  }
  apply(next: ViewTransform, row: number | null) {
    const lon = panLongitude(this.view.lon, this.affine, next, row, this.l)
    this.affine = next
    this.view = { k: next.k, y: next.y, lon }
  }
  /** A drag by (dx, dy) with the pointer at row `row` (d3 translates by the pointer's move). */
  drag(dx: number, dy: number, row: number) {
    const { k, x, y } = this.affine
    this.apply({ k, x: x + dx, y: clampView({ k, y: y + dy }, this.l).y }, row)
  }
  /** A wheel step or pinch: zoom by `f` about screen point p (d3 keeps the plane's point under p). */
  zoomAbout(f: number, [px, py]: [number, number], row: number | null): boolean {
    const { k, x, y } = this.affine
    const k1 = k * f
    const free = py - (py - y) * k1 / k
    const y1 = clampView({ k: k1, y: free }, this.l).y
    this.apply({ k: k1, x: px - (px - x) * k1 / k, y: y1 }, row)
    return y1 !== free
  }
}

describe('panLongitude: dragging turns the world', () => {
  it.each([0, 45, 70, -55])('keeps the grabbed point at %s° under the pointer, stroke after stroke across the antimeridian', lat => {
    const g = new Gesture(limits, clampView({ k: 3, y: 0, lon: 150 }, limits))
    // Bring the vertical pan to put this latitude across the middle of the screen.
    g.drag(0, 418 - screenOf(limits, g.view, [150, lat])[1], 418)
    let crossed = false
    // Strokes from x = 900 to x = 180 in 9px steps, each grabbing whatever is under the pointer.
    for (let stroke = 0; stroke < 6; stroke++) {
      const row = screenOf(limits, g.view, [150, lat])[1]
      const grabbed = locateAt(g.view, limits, 900, row)
      if (!grabbed) throw new Error('nothing under the pointer')
      for (let i = 1; i <= 80; i++) {
        const before = g.view.lon
        g.drag(-9, 0, row)
        if (before > 0 && g.view.lon < 0) crossed = true
        const [x, y] = screenOf(limits, g.view, grabbed)
        // Exactly under the pointer at every step: no jump, at the antimeridian or anywhere.
        expect(x).toBeCloseTo(900 - 9 * i, 6)
        expect(y).toBeCloseTo(row, 6)
        expect(g.view.lon).toBeGreaterThanOrEqual(-180)
        expect(g.view.lon).toBeLessThan(180)
      }
    }
    // The central meridian went past 180° and wrapped.
    expect(crossed).toBe(true)
  })

  it('turns by the same amount for the same drag whatever d3\'s x has run up to', () => {
    const a = new Gesture(limits, clampView({ k: 3, y: 0, lon: 10 }, limits))
    const b = new Gesture(limits, clampView({ k: 3, y: 0, lon: 10 }, limits))
    b.affine = { ...b.affine, x: b.affine.x - 7e6 }
    a.drag(-250, 0, 300)
    b.drag(-250, 0, 300)
    expect(b.view.lon).toBeCloseTo(a.view.lon, 6)
  })

  it('pans up and down without turning', () => {
    const g = new Gesture(limits, clampView({ k: 4, y: 0, lon: -20 }, limits))
    g.drag(0, 150, 300)
    expect(g.view.lon).toBe(-20)
  })
})

describe('panLongitude: zooming keeps the point under the pointer', () => {
  it.each([[100, 120], [900, 150], [540, 700], [10, 418]] as [number, number][])('wheel at (%s, %s), on a map centred near 180°', (px, py) => {
    const g = new Gesture(limits, clampView({ k: 2.2, y: 0, lon: 178 }, limits))
    const under = locateAt(g.view, limits, px, py)
    if (!under) throw new Error('nothing under the pointer')
    for (const f of [1.2, 1.2, 1.5, 0.8, 2]) {
      const clamped = g.zoomAbout(f, [px, py], py)
      const [x, y] = screenOf(limits, g.view, under)
      expect(x).toBeCloseTo(px, 6)
      // Vertically too, unless the clamp moved the view (zooming out near the top and bottom rows).
      if (!clamped) expect(y).toBeCloseTo(py, 6)
    }
  })

  it('a pinch on a phone keeps the point between the fingers in place', () => {
    const g = new Gesture(phone, clampView({ k: 4, y: -500, lon: -175 }, phone))
    const mid: [number, number] = [250, 400]
    const under = locateAt(g.view, phone, ...mid)
    if (!under) throw new Error('nothing under the fingers')
    for (const f of [1.05, 1.1, 1.1, 0.95]) g.zoomAbout(f, mid, mid[1])
    const [x, y] = screenOf(phone, g.view, under)
    expect(x).toBeCloseTo(mid[0], 6)
    expect(y).toBeCloseTo(mid[1], 6)
  })

  it('the +/- buttons zoom about the middle without turning', () => {
    const g = new Gesture(limits, clampView({ k: 2, y: 0, lon: 99 }, limits))
    g.zoomAbout(1.5, [540, 418], null)
    expect(g.view.lon).toBeCloseTo(99, 9)
  })

  it('a cluster click zooms about the cluster (no pointer: the row the zoom kept still)', () => {
    const g = new Gesture(limits, clampView({ k: 2, y: 0, lon: -170 }, limits))
    const cluster: [number, number] = [880, 300]
    const under = locateAt(g.view, limits, ...cluster)
    if (!under) throw new Error('nothing under the cluster')
    g.zoomAbout(3, cluster, null)
    const [x, y] = screenOf(limits, g.view, under)
    expect(x).toBeCloseTo(cluster[0], 6)
    expect(y).toBeCloseTo(cluster[1], 6)
  })
})

describe('zoomRow', () => {
  it('is the row both transforms put the same point on, or null without a zoom', () => {
    const prev = { k: 2, x: 10, y: -40 }
    const next = { k: 3, x: -100, y: -40 - 150 }
    // Zoom by 1.5 about row 260: y1 = 260 - (260 - y0) * 1.5.
    expect(zoomRow(prev, { ...next, y: 260 - (260 + 40) * 1.5 })).toBeCloseTo(260)
    expect(zoomRow(prev, { ...prev, x: 50 })).toBeNull()
  })
})
