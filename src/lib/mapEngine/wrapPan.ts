import { geoEqualEarthRaw } from 'd3-geo'
import { wrapLon } from './globeMotion'
import { OUTLINE_HALF_HEIGHT, outlineHalfWidth } from './outline'
import type { ViewTransform } from './renderer'
import type { FlatLimits } from './views'

/**
 * How the flat map turns the world when d3-zoom moves sideways.
 *
 * d3-zoom keeps a plain affine transform (k, x, y) and knows nothing of the
 * wrap. The flat map keeps its `y` and `k` as they are and reads the sideways
 * part as a turn of the world: whenever the canvas's middle column moves `dx`
 * px (at zoom 1) across d3's plane, the central meridian moves by `dx` at the
 * rate of the anchor row's latitude (px per degree there). The anchor is the
 * pointer (a drag's grabbed point, a wheel's or pinch's centre), so the
 * country under the pointer stays exactly under it as it pans or zooms at any
 * latitude, as on a flat map, even though a degree is shorter near the poles.
 * d3's `x` is left to run free (unbounded); only its changes count, so there
 * is never a jump, at the antimeridian or anywhere else, and d3's gestures
 * stay exactly as they are.
 *
 * `row` is the anchor's screen y, or null for a change with no pointer
 * (`scaleBy` from the buttons or a cluster click): the row d3 zoomed about,
 * worked out from the change itself, or the visible middle for a plain pan.
 */
export function panLongitude(lon: number, prev: ViewTransform, next: ViewTransform, row: number | null, limits: FlatLimits): number {
  const { size, bottom, centre: [, cy], scale } = limits
  const halfW = size.width / 2
  const dx = (halfW - next.x) / next.k - (halfW - prev.x) / prev.k
  if (dx === 0) return lon
  const anchor = row ?? zoomRow(prev, next) ?? (size.height - bottom) / 2
  // The world's height (outline units) under the anchor, and how many px at zoom 1 a degree of longitude is there.
  const v = Math.max(-OUTLINE_HALF_HEIGHT, Math.min(OUTLINE_HALF_HEIGHT, (cy - (anchor - next.y) / next.k) / scale))
  const perDegree = (scale * perRadian(v) * Math.PI) / 180
  return wrapLon(lon + dx / perDegree)
}

/** Equal Earth's raw x per radian of longitude at raw height `v` (a function of the latitude alone). */
function perRadian(v: number): number {
  const phi = geoEqualEarthRaw.invert?.(0, v)[1]
  return phi === undefined ? outlineHalfWidth(v) / Math.PI : geoEqualEarthRaw(1, phi)[0]
}

/** The screen row a pure zoom kept still (where both transforms put the same point), or null if the zoom did not change. */
export function zoomRow(prev: ViewTransform, next: ViewTransform): number | null {
  if (prev.k === next.k) return null
  return (next.k * prev.y - prev.k * next.y) / (next.k - prev.k)
}
