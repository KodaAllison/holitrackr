import { geoEqualEarth } from 'd3-geo'
import type { Rotation } from './globeMotion'
import type { ViewTransform } from './renderer'

/**
 * The geometry both map views share, so the globe ⇄ flat morph can start and
 * land exactly where each view draws.
 */
export interface Size {
  width: number
  height: number
}

export interface GlobeView {
  rotate: Rotation
  zoom: number
}

/** Where the globe starts: Europe and Africa facing, slightly tilted. */
export const DEFAULT_GLOBE: GlobeView = { rotate: [-15, -25], zoom: 1 }

const GLOBE_PAD = 12
const FLAT_PAD = 4

/** The globe's radius at zoom 1. */
export function globeRadius({ width, height }: Size): number {
  return Math.max(1, Math.min(width, height) / 2 - GLOBE_PAD)
}

/** The flat map's Equal Earth projection at zoom 1, fitted to the canvas. */
export function flatProjection({ width, height }: Size) {
  return geoEqualEarth().fitExtent(
    [[FLAT_PAD, FLAT_PAD], [Math.max(FLAT_PAD + 1, width - FLAT_PAD), Math.max(FLAT_PAD + 1, height - FLAT_PAD)]],
    { type: 'Sphere' }
  )
}

/** Where the flat map draws with a pan/zoom transform applied. */
export function flatFrame(size: Size, t: ViewTransform): { scale: number; translate: [number, number] } {
  const p = flatProjection(size)
  const [tx, ty] = p.translate()
  return { scale: p.scale() * t.k, translate: [tx * t.k + t.x, ty * t.k + t.y] }
}
