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

/** Space (CSS px) the map keeps clear on each side, e.g. under floating controls. */
export interface MapInset {
  top: number
  right: number
  bottom: number
  left: number
}

export const NO_INSET: MapInset = { top: 0, right: 0, bottom: 0, left: 0 }

/**
 * The flat map's Equal Earth projection at zoom 1, fitted to the canvas, or
 * to the part of it inside `inset` (falling back to the whole canvas when
 * the inset leaves no room).
 */
export function flatProjection({ width, height }: Size, inset: MapInset = NO_INSET) {
  const roomy = width - inset.left - inset.right > 40 && height - inset.top - inset.bottom > 40
  const { top, right, bottom, left } = roomy ? inset : NO_INSET
  const x0 = left + FLAT_PAD
  const y0 = top + FLAT_PAD
  return geoEqualEarth().fitExtent(
    [[x0, y0], [Math.max(x0 + 1, width - right - FLAT_PAD), Math.max(y0 + 1, height - bottom - FLAT_PAD)]],
    { type: 'Sphere' }
  )
}

/**
 * The pan/zoom that frames `bounds` (projected at zoom 1) in the part of
 * the canvas inside `inset`, filling at most `fill` of it, zoom clamped to
 * [1, maxZoom].
 */
export function flatFit(
  [[x0, y0], [x1, y1]]: [[number, number], [number, number]],
  { width, height }: Size,
  inset: MapInset,
  maxZoom: number,
  fill = 0.85,
): ViewTransform {
  const w = Math.max(1, width - inset.left - inset.right)
  const h = Math.max(1, height - inset.top - inset.bottom)
  const k = Math.min(maxZoom, Math.max(1, fill / Math.max((x1 - x0) / w, (y1 - y0) / h)))
  const cx = inset.left + w / 2
  const cy = inset.top + h / 2
  return { k, x: cx - k * (x0 + x1) / 2, y: cy - k * (y0 + y1) / 2 }
}

/** Where the flat map draws with a pan/zoom transform applied. */
export function flatFrame(size: Size, t: ViewTransform): { scale: number; translate: [number, number] } {
  const p = flatProjection(size)
  const [tx, ty] = p.translate()
  return { scale: p.scale() * t.k, translate: [tx * t.k + t.x, ty * t.k + t.y] }
}
