import { geoInterpolate } from 'd3-geo'

/**
 * Pure motion maths for the globe. A globe's orientation is d3's projection
 * `rotate` = [-lon, -lat] of the point facing the viewer.
 */
export type Rotation = [number, number]
export type LonLat = [number, number]

/** How far the view may tilt towards a pole, in degrees. */
export const MAX_TILT = 80
/** Tilt used when turning to face a country, so high latitudes stay readable. */
const FACE_TILT = 60

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Normalise a longitude into [-180, 180). */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180
}

/** The point facing the viewer. */
export function centerOf([lambda, phi]: Rotation): LonLat {
  return [wrapLon(-lambda), -phi]
}

/** The rotation that faces `point`, with the tilt limited. */
export function facing([lon, lat]: LonLat): Rotation {
  return [wrapLon(-lon), -clamp(lat, -FACE_TILT, FACE_TILT)]
}

/**
 * Rotation after dragging by (dx, dy) screen px on a globe of `radius` px.
 * One radius of drag turns the globe by one radian, so the point under the
 * pointer roughly follows it.
 */
export function dragRotate([lambda, phi]: Rotation, dx: number, dy: number, radius: number): Rotation {
  const k = 180 / Math.PI / radius
  return [wrapLon(lambda + dx * k), clamp(phi - dy * k, -MAX_TILT, MAX_TILT)]
}

/** Inertia: velocity (deg/ms) after `dt` ms of friction. */
export function decay(velocity: number, dt: number): number {
  return velocity * Math.pow(0.994, dt)
}

/** Ease-in-out cubic on [0, 1]. */
export function ease(t: number): number {
  const u = clamp(t, 0, 1)
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}

/**
 * A turn from `from` to face `to` along the great circle between the two
 * view centres, so the globe takes the short way round. Returns rotation at
 * progress t in [0, 1], plus a duration that grows with the arc length.
 */
export function turnTo(from: Rotation, to: LonLat): { at: (t: number) => Rotation; duration: number } {
  const target = facing(to)
  const start = centerOf(from)
  const end = centerOf(target)
  const path = geoInterpolate(start, end)
  const arc = Math.acos(clamp(
    Math.sin(rad(start[1])) * Math.sin(rad(end[1])) +
    Math.cos(rad(start[1])) * Math.cos(rad(end[1])) * Math.cos(rad(end[0] - start[0])),
    -1, 1
  ))
  return {
    at: t => (t >= 1 ? target : facing(path(ease(t)))),
    duration: 450 + 650 * (arc / Math.PI),
  }
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180
}
