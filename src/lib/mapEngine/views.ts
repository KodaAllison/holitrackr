import { geoBounds, geoEqualEarth, geoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo'
import { centerOf, wrapLon, type Rotation } from './globeMotion'
import { OUTLINE_HALF_HEIGHT, outlineHalfWidth, outlineRay, outlineReach } from './outline'
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

/** The longitude facing the viewer on the globe: the flat map opens (and the unroll lands) with it down the middle. */
export function globeLon(globe: GlobeView): number {
  return centerOf(globe.rotate)[0]
}

const GLOBE_PAD = 12
const FLAT_PAD = 4

/** The globe's radius at zoom 1. */
export function globeRadius({ width, height }: Size): number {
  return Math.max(1, Math.min(width, height) / 2 - GLOBE_PAD)
}

/**
 * Space (CSS px) the map keeps clear on each side, e.g. under floating
 * controls. The flat map turns about the canvas's middle column, so its
 * framings assume `left` and `right` are equal (they are 0 everywhere).
 */
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
 * The flat map's Equal Earth projection at zoom 1 and central meridian 0°,
 * fitted to the canvas, or to the part of it inside `inset` (falling back to
 * the whole canvas when the inset leaves no room).
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
 * Where the flat map is looking. The map wraps east-west: a sideways pan
 * turns the world about the pole (the projection's central meridian, `lon`,
 * goes down the middle of the canvas), so there is no east or west edge and
 * the antimeridian is always half a world away from the middle of the
 * screen, out of sight. Zoom and the vertical pan are d3-zoom's `k` and `y`.
 */
export interface FlatView {
  k: number
  y: number
  /** The longitude down the middle of the canvas, in degrees. */
  lon: number
}

/**
 * What keeps the flat map covering what the user can see. Sideways there is
 * nothing to limit (the world wraps, see `FlatView`). The visible rectangle
 * is the whole canvas width and its height less `bottom`, and since it is
 * always centred on the world's central meridian, it stays inside the curved
 * Equal Earth outline exactly when its corners nearest a pole do: with the
 * rectangle `2a` by `2b` at zoom 1 (`a = W/2k`, `b = (H - bottom)/2k`, in
 * outline units) and its centre `v` above the outline's centre,
 * `|v| + b <= reach(a)`, the height up to which the outline is at least `a`
 * half-wide (see `outline.ts`). So no bare canvas ever shows: not past the
 * pole lines, nor beside the narrowing outline in the top and bottom rows.
 *
 * Below `lg` the sheet peek is a full-width opaque panel, so nothing under it
 * is seen (`bottom` is what the sheet covers, not the projection inset; the
 * caller leaves out the sheet's rounded top corners), which lets southern
 * countries (NZ, Chile) be framed in the clear band. The top is not relaxed:
 * the floating search band is translucent and leaves map visible beside it.
 * The inset also shapes the zoom-1 projection (see `flatProjection`), so
 * where the world sits and what "Fit" centres on.
 *
 * `minK` is the smallest zoom at which the rectangle fits: centred, its
 * corners on the outline (where the corner ray from the centre meets it,
 * `outlineRay`). At `minK` the World view is the only vertical position; on
 * a tall phone the corners stop on the flat pole lines, so the world's
 * height just covers the clear band, while on a landscape canvas they stop
 * on the curved sides a little short of the poles (1080x836: the World view
 * shows 222° of longitude along the equator and 80°S to 80°N down the
 * middle; a 390x844 phone with the sheet shows 112°, pole to pole). Zooming in only loosens the condition, so every zoom in
 * `[minK, maxK]` has a vertical pan range.
 */
export interface FlatLimits {
  size: Size
  /** The world's projected bounding box at zoom 1 and central meridian 0°. */
  bounds: Bounds
  /** The outline's centre at zoom 1 (the projection's translate). */
  centre: [number, number]
  /** The projection's scale at zoom 1: outline units to px. */
  scale: number
  /** Height at the bottom of the canvas that is covered by opaque UI (0 if none). */
  bottom: number
  minK: number
  maxK: number
}

/** The flat map's limits for a canvas `size`; `maxZoom` is the user's zoom-in maximum. */
export function flatLimits(size: Size, inset: MapInset, maxZoom: number, coveredBottom: number = inset.bottom): FlatLimits {
  const projection = flatProjection(size, inset)
  const bounds = geoPath(projection).bounds({ type: 'Sphere' })
  const [cx, cy] = projection.translate()
  const scale = projection.scale()
  const bottom = usableInset(size, inset) === inset ? Math.min(coveredBottom, inset.bottom) : 0
  const halfW = Math.max(0.5, size.width / 2)
  const halfH = Math.max(0.5, (size.height - bottom) / 2)
  // The visible rectangle's corners just touch the outline: b = halfH / (k * scale) = outlineRay(halfW / halfH).
  const minK = halfH / (scale * outlineRay(halfW / halfH))
  return { size, bounds, centre: [cx, cy], scale, bottom, minK, maxK: Math.max(maxZoom, minK) }
}

/** The world's width along the equator at zoom 1, px. */
export function worldWidth({ bounds: [[x0], [x1]] }: FlatLimits): number {
  return x1 - x0
}

/** The flat map's projection at zoom 1 with `lon` as its central meridian. */
export function projectionAt({ scale, centre }: FlatLimits, lon: number): GeoProjection {
  return geoEqualEarth().scale(scale).translate(centre).rotate([-lon, 0])
}

/** The pan/zoom that draws `projectionAt(limits, view.lon)` where `view` puts it: its central meridian down the middle of the canvas. */
export function renderTransform({ k, y }: FlatView, { size, centre }: FlatLimits): ViewTransform {
  return { k, x: size.width / 2 - k * centre[0], y }
}

/** [lon, lat] under screen point (x, y) of `view`. */
export function locateAt(view: FlatView, limits: FlatLimits, x: number, y: number): [number, number] | null {
  const t = renderTransform(view, limits)
  return projectionAt(limits, view.lon).invert?.([(x - t.x) / t.k, (y - t.y) / t.k]) ?? null
}

/** Rounding slack (px, far under one) within which a view counts as inside, so the clamp is idempotent. */
const SLACK = 1e-9

/** The vertical pans (`y`, CSS px) allowed at zoom `k`, low to high (see `FlatLimits`). */
function panRange(k: number, { size, centre: [, cy], scale, bottom }: FlatLimits): [number, number] {
  const halfH = (size.height - bottom) / 2
  const unit = k * scale
  const a = size.width / 2 / unit
  const b = halfH / unit
  const maxV = Math.max(0, Math.min(OUTLINE_HALF_HEIGHT, outlineReach(a)) - b)
  // The visible centre sits `v` outline units above the outline's centre: y = halfH - k * (cy - scale * v).
  return [halfH - k * (cy + scale * maxV), halfH - k * (cy - scale * maxV)]
}

/**
 * The one clamp every caller uses (d3-zoom's `constrain`, animation steps,
 * the fits, `coverView`, `rescaleView` and the morph): the zoom into
 * `[minK, maxK]`, then the vertical pan to the nearest one that keeps the
 * visible canvas inside the world (see `FlatLimits`). Anything else in `t`,
 * such as the central meridian or d3's sideways translate, passes through.
 * A view already inside is returned as it is, so the clamp is idempotent.
 */
export function clampView<T extends { k: number; y: number }>(t: T, limits: FlatLimits): T {
  const k = Math.min(limits.maxK, Math.max(limits.minK, t.k))
  const [lo, hi] = panRange(k, limits)
  if (k === t.k && t.y >= lo - SLACK && t.y <= hi + SLACK) return t
  return { ...t, k, y: Math.min(hi, Math.max(lo, t.y)) }
}

/** The widest view, "World view": the world at its smallest zoom, centred in the visible canvas, `lon` down the middle. */
export function coverView(limits: FlatLimits, lon = 0): FlatView {
  const { size, centre: [, cy], bottom, minK } = limits
  return clampView({ k: minK, y: (size.height - bottom) / 2 - minK * cy, lon: wrapLon(lon) }, limits)
}

/**
 * Carry a view across a resize: the same meridian down the middle, the same
 * height of the world at the middle of the visible canvas, and the same zoom
 * relative to the smallest zoom (`minK`).
 */
export function rescaleView(t: FlatView, from: FlatLimits, to: FlatLimits): FlatView {
  const fromHalf = (from.size.height - from.bottom) / 2
  const toHalf = (to.size.height - to.bottom) / 2
  const v = ((fromHalf - t.y) / t.k - from.centre[1]) / from.scale
  const k = t.k / from.minK * to.minK
  return clampView({ k, y: toHalf - k * (to.centre[1] + to.scale * v), lon: t.lon }, to)
}

/**
 * The middle of the shortest stretch of longitude covering every box
 * (`geoBounds`, west > east when one crosses 180°): opposite the middle of
 * the widest gap between them. Null when they leave no gap (or there are
 * none), so no central meridian keeps them all off the antimeridian.
 */
export function coveringLongitude(boxes: [[number, number], [number, number]][]): number | null {
  const arcs = boxes
    .map(([[west], [east]]): [number, number] => {
      const start = wrapLon(west)
      const span = east >= west ? east - west : east + 360 - west
      return [start, start + Math.min(360, span)]
    })
    .sort((p, q) => p[0] - q[0])
  if (arcs.length === 0) return null
  let end = arcs[0][1]
  let [gap, middle] = [0, 0]
  for (const [start, stop] of arcs.slice(1)) {
    if (start - end > gap) [gap, middle] = [start - end, (start + end) / 2]
    end = Math.max(end, stop)
  }
  const around = arcs[0][0] + 360 - end
  if (around > gap) [gap, middle] = [around, (end + arcs[0][0] + 360) / 2]
  return gap > 1e-9 ? wrapLon(middle + 180) : null
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
 * The central meridian that centres `objects` (their bounding box, at zoom 1)
 * on the middle of the canvas, with their projected bounds there. It starts
 * from the middle of the stretch of longitude they cover (`fallback` when
 * they cover every longitude) and then corrects for the projection: turning
 * the map by a degree moves a point by less near the poles than at the
 * equator, so the bounds' middle is nudged onto the centre (a few steps of
 * Newton's method at the rate of the bounds' middle row).
 */
export function centreObjects(objects: GeoPermissibleObjects[], limits: FlatLimits, fallback: number): { lon: number; box: Bounds } | null {
  const start = coveringLongitude(objects.map(o => geoBounds(o)))
  let lon = start ?? wrapLon(fallback)
  const boxAt = (l: number) => {
    const path = geoPath(projectionAt(limits, l))
    return unionBounds(objects.map(o => path.bounds(o)))
  }
  let box = boxAt(lon)
  if (!box) return null
  const { scale, centre: [cx, cy] } = limits
  for (let i = 0; i < 4 && start !== null; i++) {
    const off = (box[0][0] + box[1][0]) / 2 - cx
    if (Math.abs(off) < 0.01) break
    // px per degree of longitude at zoom 1, along the bounds' middle row.
    const perDegree = (scale * outlineHalfWidth((cy - (box[0][1] + box[1][1]) / 2) / scale)) / 180
    const turned = wrapLon(lon + Math.max(-30, Math.min(30, off / perDegree)))
    const next = boxAt(turned)
    if (!next) break
    lon = turned
    box = next
  }
  return { lon, box }
}

/** Zooms tried between the requested one and minK when a box cannot be wholly shown. */
const ZOOM_STEPS = 12

/**
 * The view that frames `box` (projected at zoom 1 with `lon` down the
 * middle, so already centred sideways) in the part of the canvas inside
 * `inset`, filling at most `fill` of it, the zoom kept to [1, maxZoom] and
 * then to the limits; the result is a fixed point of `clampView`, exactly
 * where the map will land.
 *
 * The view must not cut `keep` (the fits pass the objects' own bounds when
 * `box` was widened for a small country): it is the nearest allowed one that
 * shows `keep` whole in the clear area. Near a pole there may be none at the
 * asked zoom (the vertical clamp keeps the pole lines at the canvas edge), so
 * the zoom steps down to the largest that has one. If no zoom does (on a
 * phone, a country so far north it sits under the search band; or one wider
 * than the canvas even at `minK`), it is the plain clamp at the asked zoom,
 * or a smaller zoom only if that shows clearly more.
 */
export function frameBox(
  box: Bounds, keep: Bounds, lon: number, limits: FlatLimits, inset: MapInset, maxZoom: number, fill: number,
): FlatView {
  const { size: { width, height }, minK, maxK } = limits
  const [[x0, y0], [x1, y1]] = box
  const w = Math.max(1, width - inset.left - inset.right)
  const h = Math.max(1, height - inset.top - inset.bottom)
  const asked = Math.min(maxZoom, Math.max(1, fill / Math.max((x1 - x0) / w, (y1 - y0) / h)))
  const top = Math.min(maxK, Math.max(minK, asked))
  const middle = inset.top + h / 2
  const at = (z: number): FlatView => ({ k: z, y: middle - z * (y0 + y1) / 2, lon })
  // The nearest view at zoom z that shows the whole of `keep` in the clear area, if any.
  const whole = (z: number): FlatView | null => {
    const [[kx0, ky0], [kx1, ky1]] = keep
    const t = renderTransform(at(z), limits)
    if (t.x + z * kx0 < inset.left - SLACK || t.x + z * kx1 > width - inset.right + SLACK) return null
    const [lo, hi] = panRange(z, limits)
    const from = Math.max(lo, inset.top - z * ky0)
    const to = Math.min(hi, height - inset.bottom - z * ky1)
    if (from > to + SLACK) return null
    return clampView({ ...at(z), y: Math.min(to, Math.max(from, at(z).y)) }, limits)
  }
  const exact = whole(top)
  if (exact) return exact
  // Step the zoom out until a view shows it whole, then narrow down on the largest such zoom.
  let above = top
  for (let i = 1; i <= ZOOM_STEPS; i++) {
    const z = top * Math.pow(minK / top, i / ZOOM_STEPS)
    if (!whole(z)) {
      above = z
      continue
    }
    let below = z
    for (let j = 0; j < 20; j++) {
      const mid = Math.sqrt(below * above)
      if (whole(mid)) below = mid
      else above = mid
    }
    return whole(below) ?? clampView(at(below), limits)
  }
  // It shows whole at no zoom: the plain clamp at the asked zoom, or a smaller zoom if that shows clearly more of it.
  const shown = (v: FlatView) => shownShare(keep, renderTransform(v, limits), limits.size, inset)
  let best = clampView(at(top), limits)
  let bestShown = shown(best)
  for (let i = 1; i <= ZOOM_STEPS; i++) {
    const v = clampView(at(top * Math.pow(minK / top, i / ZOOM_STEPS)), limits)
    const seen = shown(v)
    if (seen > bestShown + 0.05) [best, bestShown] = [v, seen]
  }
  return best
}

/** The share of `box` (projected at zoom 1) that view `t` shows inside the clear area (the canvas less `inset`). */
export function shownShare([[x0, y0], [x1, y1]]: Bounds, t: ViewTransform, { width, height }: Size, inset: MapInset): number {
  const [X0, X1, Y0, Y1] = [t.x + t.k * x0, t.x + t.k * x1, t.y + t.k * y0, t.y + t.k * y1]
  const across = Math.max(0, Math.min(X1, width - inset.right) - Math.max(X0, inset.left))
  const down = Math.max(0, Math.min(Y1, height - inset.bottom) - Math.max(Y0, inset.top))
  const area = Math.max(1e-9, (X1 - X0) * (Y1 - Y0))
  return Math.min(1, (across * down) / area)
}

/**
 * Widen `bounds` about their centre to at least `minWidth` px across, so a
 * fit to one small country still shows its neighbours (e.g. a continent).
 */
export function widenBounds([[x0, y0], [x1, y1]]: Bounds, minWidth: number): Bounds {
  const grow = Math.max(0, minWidth - (x1 - x0)) / 2
  return [[x0 - grow, y0], [x1 + grow, y1]]
}

/** Projected width (px at zoom 1) of `degrees` of longitude on a world `width` px wide. */
export function spanWidth(width: number, degrees: number): number {
  return width * Math.min(360, Math.max(0, degrees)) / 360
}

/**
 * Frame `objects` (GeoJSON): turn the map so they sit in the middle (the
 * short way round the antimeridian, whatever the view was), then zoom to
 * fill at most `fill` of the clear area, never narrower than `minWidth` px
 * at zoom 1, showing them whole where the limits allow. Null for nothing.
 */
function frameObjects(
  objects: GeoPermissibleObjects[], limits: FlatLimits, inset: MapInset, maxZoom: number, fill: number, minWidth: number, lon: number,
): FlatView | null {
  const centred = objects.length > 0 ? centreObjects(objects, limits, lon) : null
  if (!centred) return null
  return frameBox(widenBounds(centred.box, minWidth), centred.box, centred.lon, limits, inset, maxZoom, fill)
}

/**
 * "Fit to my countries": the view framing the marked countries' shapes
 * inside `inset`, never narrower than `minWidth` px at zoom 1; the World
 * view about `lon` (the current central meridian) when there are none.
 */
export function frameMarked(
  shapes: GeoPermissibleObjects[], limits: FlatLimits, inset: MapInset, maxZoom: number, minWidth = 0, lon = 0,
): FlatView {
  return frameObjects(shapes, limits, inset, maxZoom, 0.85, minWidth, lon) ?? coverView(limits, lon)
}

/**
 * Focus on one country: the view framing `shape` (its mainland) inside
 * `inset` with room around it, never narrower than `minWidth` px at zoom 1,
 * so a small country keeps its neighbours.
 */
export function frameCountry(
  shape: GeoPermissibleObjects, limits: FlatLimits, inset: MapInset, maxZoom: number, minWidth = 0, lon = 0,
): FlatView {
  return frameObjects([shape], limits, inset, maxZoom, 0.7, minWidth, lon) ?? coverView(limits, lon)
}

/** Where the morph's flat end draws `view`: the scale, translate and central meridian of `projectionAt` with the pan/zoom applied. */
export function flatFrame(limits: FlatLimits, view: FlatView): { scale: number; translate: [number, number]; lon: number } {
  const t = renderTransform(view, limits)
  const [cx, cy] = limits.centre
  return { scale: limits.scale * t.k, translate: [cx * t.k + t.x, cy * t.k + t.y], lon: view.lon }
}
