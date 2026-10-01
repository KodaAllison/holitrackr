import { geoEqualEarthRaw, geoProjection, type GeoProjection } from 'd3-geo'

/**
 * The globe ⇄ flat "unroll": a projection whose raw function blends an
 * orthographic globe (t = 0) into Equal Earth (t = 1).
 */
type Raw = (lambda: number, phi: number) => [number, number]

/**
 * Orthographic, except the far hemisphere is folded outward into a ring
 * beyond the limb instead of mirroring onto the front. That keeps the blend
 * with Equal Earth one-to-one everywhere, so nothing overlaps mid-morph.
 */
export const unfoldedOrthographicRaw: Raw = (lambda, phi) => {
  const x = Math.cos(phi) * Math.sin(lambda)
  const y = Math.sin(phi)
  if (Math.cos(phi) * Math.cos(lambda) >= 0) return [x, y]
  const r = Math.hypot(x, y)
  if (r < 1e-9) return [2, 0]
  const k = (2 - r) / r
  return [x * k, y * k]
}

/** The blended raw projection at progress t (0 globe, 1 flat). */
export function morphRaw(t: number): Raw {
  return (lambda, phi) => {
    const [ax, ay] = unfoldedOrthographicRaw(lambda, phi)
    const [bx, by] = geoEqualEarthRaw(lambda, phi)
    return [ax + (bx - ax) * t, ay + (by - ay) * t]
  }
}

/**
 * A reusable morph projection: call `setT` then set scale/translate/rotate
 * for each frame. d3 re-reads the raw function on every stream, so changing
 * t between frames takes effect immediately.
 */
export function createMorphProjection(): { projection: GeoProjection; setT: (t: number) => void } {
  let raw = morphRaw(0)
  const projection = geoProjection((lambda, phi) => raw(lambda, phi))
  return { projection, setT: t => { raw = morphRaw(t) } }
}
