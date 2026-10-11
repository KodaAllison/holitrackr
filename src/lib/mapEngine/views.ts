import { geoEqualEarth, geoPath } from 'd3-geo'
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

/** Projected bounds `[[x0, y0], [x1, y1]]` in CSS px. */
export type Bounds = [[number, number], [number, number]]

export const NO_INSET: MapInset = { top: 0, right: 0, bottom: 0, left: 0 }

/** The inset, or none when it leaves no room. */
function usableInset({ width, height }: Size, inset: MapInset): MapInset {
  const roomy = width - inset.left - inset.right > 40 && height - inset.top - inset.bottom > 40
  return roomy ? inset : NO_INSET
}

/**
 * The flat map's Equal Earth projection at zoom 1, fitted to the canvas, or
 * to the part of it inside `inset` (falling back to the whole canvas when
 * the inset leaves no room).
 */
export function flatProjection({ width, height }: Size, inset: MapInset = NO_INSET) {
  const { top, right, bottom, left } = usableInset({ width, height }, inset)
  const x0 = left + FLAT_PAD
  const y0 = top + FLAT_PAD
  return geoEqualEarth().fitExtent(
    [[x0, y0], [Math.max(x0 + 1, width - right - FLAT_PAD), Math.max(y0 + 1, height - bottom - FLAT_PAD)]],
    { type: 'Sphere' }
  )
}

/** The most the flat map zooms in (the +/- buttons and gestures). */
export const FLAT_MAX_ZOOM = 12

/**
 * What keeps the flat map covering what the user can see: the world's
 * projected bounds at zoom 1 and the zoom range `[minK, maxK]`. `minK` is the
 * "cover" scale, the smallest zoom at which those bounds fill the visible
 * canvas. The world's bounding box therefore always covers the canvas, but
 * the Equal Earth outline is curved, so small wedges outside it can show
 * near the corners (roughly 5% of the canvas at the desktop world view, up
 * to about 20% on a phone panned to an edge). Used through
 * `clampView` (d3-zoom's `constrain`), not `translateExtent`, so gestures and
 * programmatic moves agree exactly.
 *
 * Top, left and right cover the whole canvas, including under the inset: the
 * floating search band is translucent and leaves map visible beside it, so
 * the world must reach the canvas edge there. The bottom is different: below
 * `lg` the sheet peek is a full-width opaque panel, so an empty strip under it
 * is never seen and the world's bottom edge may rise by the sheet's real
 * height (`bottom`: what the sheet covers, not the projection inset; the
 * caller leaves out the sheet's rounded top corners), which lets southern countries (NZ, Chile) be framed in the
 * clear band. The cover scale is computed for the visible height
 * (canvas minus `bottom`). The inset also shapes the zoom-1 projection (see
 * `flatProjection`), so where the world sits and what "Fit" centres on.
 */
export interface FlatLimits {
  size: Size
  bounds: Bounds
  /** Height at the bottom of the canvas that is covered by opaque UI (0 if none). */
  bottom: number
  minK: number
  maxK: number
}

/** The flat map's limits for a canvas `size`; `maxZoom` is the user's zoom-in maximum. */
export function flatLimits(
  size: Size, inset: MapInset, maxZoom: number, coveredBottom: number = inset.bottom,
): FlatLimits {
  const bounds = geoPath(flatProjection(size, inset)).bounds({ type: 'Sphere' })
  const [[x0, y0], [x1, y1]] = bounds
  const bottom = usableInset(size, inset) === inset ? Math.min(coveredBottom, inset.bottom) : 0
  const minK = Math.max(size.width / Math.max(1, x1 - x0), (size.height - bottom) / Math.max(1, y1 - y0))
  return { size, bounds, bottom, minK, maxK: Math.max(maxZoom, minK) }
}

const within = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)))

/** The nearest pan/zoom inside `limits`, so the visible canvas stays covered by the world. */
export function clampView(
  { k, x, y }: ViewTransform,
  { size, bounds: [[x0, y0], [x1, y1]], bottom, minK, maxK }: FlatLimits,
): ViewTransform {
  const kk = within(k, minK, maxK)
  return {
    k: kk,
    x: within(x, size.width - kk * x1, -kk * x0),
    y: within(y, size.height - bottom - kk * y1, -kk * y0),
  }
}

/** The widest view, "World view": the world at the cover scale, centred. */
export function coverView(limits: FlatLimits): ViewTransform {
  const { size, bounds: [[x0, y0], [x1, y1]], minK } = limits
  return clampView({ k: minK, x: size.width / 2 - minK * (x0 + x1) / 2, y: size.height / 2 - minK * (y0 + y1) / 2 }, limits)
}

/**
 * Carry a view across a resize: the same spot of the world stays at the
 * centre of the canvas, at the same zoom relative to the cover scale.
 */
export function rescaleView(t: ViewTransform, from: FlatLimits, to: FlatLimits): ViewTransform {
  const [[fx0, fy0], [fx1, fy1]] = from.bounds
  const [[tx0, ty0], [tx1, ty1]] = to.bounds
  const u = ((from.size.width / 2 - t.x) / t.k - fx0) / Math.max(1, fx1 - fx0)
  const v = ((from.size.height / 2 - t.y) / t.k - fy0) / Math.max(1, fy1 - fy0)
  const k = t.k / from.minK * to.minK
  return clampView({
    k,
    x: to.size.width / 2 - k * (tx0 + u * (tx1 - tx0)),
    y: to.size.height / 2 - k * (ty0 + v * (ty1 - ty0)),
  }, to)
}

/**
 * The pan/zoom that frames `bounds` (projected at zoom 1) in the part of
 * the canvas inside `inset`, filling at most `fill` of it, zoom clamped to
 * [1, maxZoom]. With `limits` it is also clamped into them, so the target
 * is exactly where the map will land (a framing near the world's edge shifts
 * rather than showing empty space).
 */
export function flatFit(
  [[x0, y0], [x1, y1]]: Bounds,
  { width, height }: Size,
  inset: MapInset,
  maxZoom: number,
  fill = 0.85,
  limits?: FlatLimits,
): ViewTransform {
  const w = Math.max(1, width - inset.left - inset.right)
  const h = Math.max(1, height - inset.top - inset.bottom)
  const k = Math.min(maxZoom, Math.max(1, fill / Math.max((x1 - x0) / w, (y1 - y0) / h)))
  const cx = inset.left + w / 2
  const cy = inset.top + h / 2
  const fit = { k, x: cx - k * (x0 + x1) / 2, y: cy - k * (y0 + y1) / 2 }
  return limits ? clampView(fit, limits) : fit
}

/** The union of projected bounds, or `null` for none. */
export function unionBounds(boxes: Iterable<Bounds>): Bounds | null {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [[a, b], [c, d]] of boxes) {
    x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d)
  }
  return x0 <= x1 && y0 <= y1 ? [[x0, y0], [x1, y1]] : null
}

/**
 * Widen `bounds` about their centre to at least `minWidth` px across, so a
 * fit to one small country still shows its neighbours (e.g. a continent).
 */
export function widenBounds([[x0, y0], [x1, y1]]: Bounds, minWidth: number): Bounds {
  const grow = Math.max(0, minWidth - (x1 - x0)) / 2
  return [[x0 - grow, y0], [x1 + grow, y1]]
}

/** Projected width (px at zoom 1) of `degrees` of longitude on a world `worldWidth` px wide. */
export function spanWidth(worldWidth: number, degrees: number): number {
  return worldWidth * Math.min(360, Math.max(0, degrees)) / 360
}

/**
 * "Fit to my countries": the pan/zoom framing `boxes` (the marked
 * countries' projected bounds) inside `inset`, never narrower than
 * `minWidth` px at zoom 1; the whole world when there are none.
 */
export function frameMarked(
  boxes: Iterable<Bounds>,
  size: Size,
  inset: MapInset,
  maxZoom: number,
  minWidth = 0,
  limits?: FlatLimits,
): ViewTransform {
  const bounds = unionBounds(boxes)
  if (!bounds) return limits ? coverView(limits) : { k: 1, x: 0, y: 0 }
  return flatFit(widenBounds(bounds, minWidth), size, inset, maxZoom, 0.85, limits)
}

/**
 * Focus on one country: the pan/zoom framing `bounds` (its mainland,
 * projected at zoom 1) inside `inset` with room around it, never narrower
 * than `minWidth` px at zoom 1, so a small country keeps its neighbours.
 */
export function frameCountry(
  bounds: Bounds,
  size: Size,
  inset: MapInset,
  maxZoom: number,
  minWidth = 0,
  limits?: FlatLimits,
): ViewTransform {
  return flatFit(widenBounds(bounds, minWidth), size, inset, maxZoom, 0.7, limits)
}

/** Where the flat map draws with a pan/zoom transform applied. */
export function flatFrame(size: Size, t: ViewTransform): { scale: number; translate: [number, number] } {
  // Only the desktop morph uses this, and it has no inset.
  const p = flatProjection(size)
  const [tx, ty] = p.translate()
  return { scale: p.scale() * t.k, translate: [tx * t.k + t.x, ty * t.k + t.y] }
}
