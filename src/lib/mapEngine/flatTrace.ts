import { geoEqualEarthRaw } from 'd3-geo'
import type { Geometry, Position } from 'geojson'
import { wrapLon } from './globeMotion'

/**
 * A fast path for drawing the flat map at any central meridian.
 *
 * Equal Earth is pseudo-cylindrical: a point's raw x is its longitude times
 * a factor of its latitude alone, and its raw y depends on the latitude
 * alone. Turning the map about the pole (d3's `rotate([-lon0, 0])`) is
 * therefore only a per-vertex sideways shift, `x = g(lat) * (lon - lon0)`,
 * with no trigonometry per frame. Both factors are worked out once per
 * vertex, so a frame with a new central meridian costs a multiply-add and a
 * `lineTo` per vertex (about 0.25ms for the detail atlas's ~38k vertices, in
 * Node, against ~15ms through d3's rotate/clip/resample pipeline).
 *
 * A ring the new antimeridian (`lon0 ± 180`) cuts is traced twice rather
 * than clipped (see `traceFlat`); only Antarctica, which spans every
 * longitude, goes through d3. Edges are drawn straight, as projected chords,
 * where d3 would resample them along great circles: on the detail atlas the
 * two differ by at most 0.13px on a 1080px-wide world (one Antarctic edge),
 * so they look the same.
 */
export interface PathSink {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  closePath(): void
}

interface Ring {
  /** Longitudes, in degrees. */
  lon: Float64Array
  /** Raw x per radian of longitude, a function of the latitude. */
  gx: Float64Array
  /** Raw y. */
  gy: Float64Array
  west: number
  east: number
  /** The ring jumps across ±180° between two vertices (or spans the globe): only d3 can draw it. */
  wraps: boolean
}

const prepared = new WeakMap<Geometry, Ring[]>()

function prepareRing(ring: Position[]): Ring {
  const n = ring.length
  const lon = new Float64Array(n)
  const gx = new Float64Array(n)
  const gy = new Float64Array(n)
  let [west, east, wraps] = [Infinity, -Infinity, false]
  for (let i = 0; i < n; i++) {
    const [l, phi] = [ring[i][0], (ring[i][1] * Math.PI) / 180]
    lon[i] = l
    gx[i] = geoEqualEarthRaw(1, phi)[0]
    gy[i] = geoEqualEarthRaw(0, phi)[1]
    west = Math.min(west, l)
    east = Math.max(east, l)
    if (i > 0 && Math.abs(l - lon[i - 1]) > 180) wraps = true
  }
  return { lon, gx, gy, west, east, wraps: wraps || east - west >= 359 }
}

function ringsOf(geometry: Geometry): Ring[] {
  let rings = prepared.get(geometry)
  if (!rings) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
    rings = polygons.flatMap(polygon => polygon.map(prepareRing))
    prepared.set(geometry, rings)
  }
  return rings
}

/** Rounding room (degrees) for a ring that only touches the antimeridian. */
const EDGE = 1e-9

/**
 * Traces `geometry` on the Equal Earth map centred on `lon0` (scale and
 * translate as d3's projection) into `sink`, placing each vertex exactly as
 * d3 does. Returns false, having traced nothing, for geometry the fast path
 * cannot draw: a ring that jumps across ±180° or spans every longitude
 * (Antarctica), or anything that is not polygons.
 *
 * A ring the antimeridian `lon0 ± 180` cuts is not clipped: it is traced
 * twice, a world's width apart, each copy whole and continuous. Since
 * `x = g(lat) * (lon - lon0)`, a point is past the world's outline exactly
 * when it is more than 180° from `lon0`, so each copy's overhang lies beyond
 * the outline's curved edge, where nothing is seen (the flat map's clamp
 * keeps the visible canvas inside the outline), and the two copies' parts
 * inside it are the two halves d3 would clip the ring into. They never
 * overlap, so any fill rule fills them once.
 */
export function traceFlat(geometry: Geometry, lon0: number, scale: number, [cx, cy]: [number, number], sink: PathSink): boolean {
  const rings = ringsOf(geometry)
  if (rings.length === 0 || rings.some(ring => ring.wraps)) return false
  const perDegree = (scale * Math.PI) / 180
  const trace = ({ lon, gx, gy }: Ring, shift: number) => {
    for (let i = 0; i < lon.length; i++) {
      const x = cx + perDegree * gx[i] * (lon[i] + shift)
      const y = cy - scale * gy[i]
      if (i === 0) sink.moveTo(x, y)
      else sink.lineTo(x, y)
    }
    sink.closePath()
  }
  for (const ring of rings) {
    // The shift of 360° that brings the ring's middle nearest the centre.
    const mid = (ring.west + ring.east) / 2 - lon0
    const shift = wrapLon(mid) - mid - lon0
    trace(ring, shift)
    // Cut by the antimeridian: the other half comes round from the far side.
    if (ring.east + shift > 180 + EDGE) trace(ring, shift - 360)
    else if (ring.west + shift < -180 - EDGE) trace(ring, shift + 360)
  }
  return true
}
