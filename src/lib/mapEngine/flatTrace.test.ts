import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { geoPath } from 'd3-geo'
import { decodeWorld } from '../worldAtlas'
import { buildCountryIndex, countryAt, type IndexedCountry } from './countryIndex'
import { flatSizes } from './flatShapes'
import { wrapLon } from './globeMotion'
import { traceFlat, type PathSink } from './flatTrace'
import { flatLimits, NO_INSET, projectionAt, worldWidth } from './views'

const index = buildCountryIndex(decodeWorld(JSON.parse(
  readFileSync(new URL('../../data/world-detail.topo.json', import.meta.url), 'utf8'),
)))
const country = (name: string): IndexedCountry => {
  const c = index.find(x => x.identity.name === name)
  if (!c) throw new Error(`no ${name} in the atlas`)
  return c
}
const limits = flatLimits({ width: 1080, height: 836 }, NO_INSET, 12)

/** Records every vertex traced, ring by ring. */
class Recorder implements PathSink {
  rings: [number, number][][] = []
  moveTo(x: number, y: number) { this.rings.push([[x, y]]) }
  lineTo(x: number, y: number) { this.rings[this.rings.length - 1].push([x, y]) }
  closePath() {}
}

/** The source rings of a country's polygons, in order. */
function rings(c: IndexedCountry): number[][][] {
  const g = c.feature.geometry
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
  return polygons.flat()
}

describe('traceFlat', () => {
  it.each([
    ['Fiji', 180], ['Fiji', 0], ['Fiji', -179], ['New Zealand', 175], ['Russia', 100], ['Russia', 160],
    ['France', -150], ['United States of America', -150], ['Kiribati', 180], ['Australia', 100], ['United States of America', 0],
  ] as const)('places every vertex of %s exactly where d3 projects it, centred on %s°', (name, lon) => {
    const c = country(name)
    const sink = new Recorder()
    expect(traceFlat(c.feature.geometry, lon, limits.scale, limits.centre, sink)).toBe(true)
    const projection = projectionAt(limits, lon)
    const source = rings(c)
    expect(sink.rings.length).toBe(source.length)
    let worst = 0
    let width = 0
    sink.rings.forEach((ring, r) => {
      const xs = ring.map(([x]) => x)
      width = Math.max(width, Math.max(...xs) - Math.min(...xs))
      ring.forEach(([x, y], i) => {
        const p = projection(source[r][i] as [number, number])
        if (!p) throw new Error('unprojectable vertex')
        // A vertex exactly on the antimeridian may land on either edge in d3; the trace keeps it with its ring.
        const dx = Math.abs(x - p[0])
        worst = Math.max(worst, Math.min(dx, Math.abs(dx - worldWidth(limits))), Math.abs(y - p[1]))
      })
    })
    expect(worst).toBeLessThan(1e-6)
    // No ring is drawn across the world.
    expect(width).toBeLessThan((limits.bounds[1][0] - limits.bounds[0][0]) / 2)
  })

  it.each([30, 0, -100])('leaves Antarctica, which spans every longitude, to d3 (map centred on %s°)', lon => {
    const sink = new Recorder()
    expect(traceFlat(country('Antarctica').feature.geometry, lon, limits.scale, limits.centre, sink)).toBe(false)
    expect(sink.rings).toEqual([])
  })

  it('traces every other country, wherever the map is centred', () => {
    for (let lon = -180; lon < 180; lon += 7.5) {
      const left = index.filter(c => !traceFlat(c.feature.geometry, lon, limits.scale, limits.centre, new Recorder()))
      expect(left.map(c => c.identity.name)).toEqual(['Antarctica'])
    }
  })

  it.each([
    ['Russia', -60], ['Russia', 0], ['Fiji', -2], ['United States of America', 80], ['Australia', -40], ['Canada', 77], ['France', -177],
  ] as const)('draws %s, cut by the antimeridian of a map centred on %s°, as d3 clips it inside the world', (name, lon) => {
    const c = country(name)
    const sink = new Recorder()
    expect(traceFlat(c.feature.geometry, lon, limits.scale, limits.centre, sink)).toBe(true)
    const projection = projectionAt(limits, lon)
    let [checked, wrong, inside] = [0, 0, 0]
    // A grid across the whole width of the world, over the country's rows, kept inside the world's outline.
    const [[x0], [x1]] = limits.bounds
    const [[, south], [, north]] = c.bounds
    const top = projection([lon, north])?.[1] ?? 0
    const bottom = projection([lon, south])?.[1] ?? 0
    for (let j = 0; j <= 20; j++) {
      const row = top + (j / 20) * (bottom - top)
      const filled = rowWinding(sink.rings, row)
      for (let i = 1; i < 500; i++) {
        const point: [number, number] = [x0 + (i / 500) * (x1 - x0), row]
        const lonLat = projection.invert?.(point)
        if (!lonLat || Math.abs(wrapLon(lonLat[0] - lon)) > 179.9) continue
        const back = projection(lonLat)
        if (!back || Math.hypot(back[0] - point[0], back[1] - point[1]) > 1e-6) continue
        checked++
        const expected = countryAt([c], lonLat) === c
        if (expected) inside++
        if (filled(point[0]) !== 0 !== expected) wrong++
      }
    }
    expect(checked).toBeGreaterThan(5000)
    expect(inside).toBeGreaterThan(0)
    // Grid points within a fraction of a pixel of a border may fall either side (straight chords against d3's arcs).
    expect(wrong).toBeLessThanOrEqual(1)
  })
})

/** The winding number of `rings` about points on row `py`, as a function of x (non-zero: inside, as the canvas fills). */
function rowWinding(rings: [number, number][][], py: number): (px: number) => number {
  // Where each edge crosses the row, and which way: a point's winding sums the crossings to its right.
  const crossings: [number, number][] = []
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [x0, y0] = ring[i]
      const [x1, y1] = ring[(i + 1) % ring.length]
      if ((y0 <= py) === (y1 <= py)) continue
      crossings.push([x0 + ((py - y0) / (y1 - y0)) * (x1 - x0), y0 <= py ? 1 : -1])
    }
  }
  return px => crossings.reduce((w, [x, dir]) => (x > px ? w + dir : w), 0)
}

describe('flatSizes', () => {
  it('measures a country across the antimeridian as itself, not the width of the world', () => {
    const sizeOf = flatSizes(limits)
    const fiji = country('Fiji')
    const [[x0], [x1]] = geoPath(projectionAt(limits, 0)).bounds(fiji.feature)
    // Centred on Greenwich, the antimeridian cuts Fiji in two and its bounds span the world.
    expect(x1 - x0).toBeGreaterThan(800)
    expect(sizeOf(fiji)).toBeLessThan(40)
    expect(sizeOf(country('Luxembourg'))).toBeLessThan(5)
  })
})
