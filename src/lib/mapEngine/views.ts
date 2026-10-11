import { geoEqualEarth, geoPath } from 'd3-geo'
import type { Rotation } from './globeMotion'
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
 * What keeps the flat map covering what the user can see. At the World view
 * (and so whenever the user zooms right out) the visible part of the canvas,
 * a rectangle, lies inside the world's curved Equal Earth outline: no bare
 * canvas shows. Zoomed in, a pan may take it a little past the outline
 * (`PanSlack`), so countries on the antimeridian (New Zealand, Fiji, Tonga)
 * can be framed with room around them; a thin wedge of canvas can then show
 * along the side, at most 120px wide. Used through `clampView` (d3-zoom's
 * `constrain`), not `translateExtent`, so gestures and programmatic moves
 * agree exactly.
 *
 * The visible rectangle is the whole canvas width and its height less
 * `bottom`: below `lg` the sheet peek is a full-width opaque panel, so
 * nothing under it is seen (`bottom` is what the sheet covers, not the
 * projection inset; the caller leaves out the sheet's rounded top corners),
 * which lets southern countries (NZ, Chile) be framed in the clear band. The
 * top is not relaxed: the floating search band is translucent and leaves map
 * visible beside it. The inset also shapes the zoom-1 projection (see
 * `flatProjection`), so where the world sits and what "Fit" centres on.
 *
 * The outline is convex (see `outline.ts`), so the rectangle is inside it when
 * its four corners are. With the rectangle `2a` by `2b` at zoom 1 (`a = W/2k`,
 * `b = (H - bottom)/2k`) and its centre `(u, v)` from the outline's centre,
 * the outline narrowing towards the poles makes the corners nearest a pole
 * bind: inside iff `|v| + b <= reach(a)` (the height up to which the outline
 * is at least `a` half-wide) and `|u| + a <= halfWidth(|v| + b)`. The pan
 * slack swaps `halfWidth(r)` for the wider `G(r)` (see `PanSlack`).
 *
 * `minK` is the smallest zoom at which the rectangle fits anywhere: centred,
 * where the outline is widest, its corners on the outline (where the corner
 * ray from the centre meets it, `outlineRay`). At `minK` the World view is
 * the only vertical position; a landscape canvas's corners stop on the
 * curved sides so it cannot pan sideways either, while a tall phone's stop on
 * the flat pole lines and it can pan sideways a little. Since both
 * conditions only loosen as `k` grows (a and b shrink), every zoom in
 * `[minK, maxK]` has a non-empty pan range in both directions.
 */
export interface FlatLimits {
  size: Size
  /** The world's projected bounding box at zoom 1. */
  bounds: Bounds
  /** The outline's centre at zoom 1 (the projection's translate). */
  centre: [number, number]
  /** The projection's scale at zoom 1: outline units to px. */
  scale: number
  /** Height at the bottom of the canvas that is covered by opaque UI (0 if none). */
  bottom: number
  /** How far a pan may take the visible canvas past the outline (see `PanSlack`). */
  slack: PanSlack
  minK: number
  maxK: number
}

/**
 * How far (screen px) a pan may take the visible canvas's corners past the
 * world's outline. A corner at height `r` from the equator may reach out to
 *
 *   G(r) = min(halfWidth(r - rows) + side, halfWidth(r) + cap)
 *
 * (`halfWidth` of a negative height is the equator's): the outline's width
 * `rows` px nearer the equator plus `side` px, but never more than `cap` px
 * past the outline at the corner's own height. `rows` lets the slant towards
 * the poles be followed down past an edge country (the binding corner is
 * the one nearest a pole, well south of New Zealand or Fiji); `side` gives
 * room beside it where the edge is upright, near the equator (Kiribati,
 * Fiji); `cap` bounds the widest wedge. Top and bottom stay strict: the
 * corners never pass the pole lines. G is concave (a minimum of two concave
 * functions; the outline's half-width is flat at the equator), so the
 * allowed region stays convex.
 *
 * The slack is 0 at `minK` and grows linearly to the full amount at
 * `SLACK_RAMP * minK`, so the World view and anything zoomed right out stay
 * wholly inside the outline. The numbers are about the smallest that frame
 * Fiji, Tonga, Samoa, Kiribati and Vanuatu at 6x, 40px clear of the sides,
 * on 390x844 and 375x667 (40/120/120 left Fiji 29px from a 390px phone's
 * edge), and New Zealand there too. On a wide desktop canvas no slack this
 * small centres New Zealand; `flatFit` then pans it off-centre so its
 * whole mainland still shows at 6x (see the tests). On a canvas narrower
 * than 375px all three numbers shrink with the width, so the widest wedge
 * is at most `SLACK_SHARE` of it.
 */
export interface PanSlack {
  side: number
  rows: number
  cap: number
}
export const PAN_SLACK: PanSlack = { side: 45, rows: 140, cap: 120 }
/** The pan slack is 0 at the World view's zoom and complete by this multiple of it. */
const SLACK_RAMP = 1.5
/** The widest wedge is at most this share of the canvas width (the slack scales down on narrower canvases). */
export const SLACK_SHARE = 0.32

/** The flat map's limits for a canvas `size`; `maxZoom` is the user's zoom-in maximum. */
export function flatLimits(
  size: Size, inset: MapInset, maxZoom: number, coveredBottom: number = inset.bottom, slack: PanSlack = PAN_SLACK,
): FlatLimits {
  const projection = flatProjection(size, inset)
  const bounds = geoPath(projection).bounds({ type: 'Sphere' })
  const [cx, cy] = projection.translate()
  const scale = projection.scale()
  const bottom = usableInset(size, inset) === inset ? Math.min(coveredBottom, inset.bottom) : 0
  const halfW = Math.max(0.5, size.width / 2)
  const halfH = Math.max(0.5, (size.height - bottom) / 2)
  // The visible rectangle's corners just touch the outline: b = halfH / (k * scale) = outlineRay(halfW / halfH).
  const minK = halfH / (scale * outlineRay(halfW / halfH))
  // On a narrow canvas the slack shrinks in proportion, so the widest wedge stays a small share of it.
  const f = Math.min(1, (SLACK_SHARE * size.width) / Math.max(1, slack.cap))
  const scaled = { side: slack.side * f, rows: slack.rows * f, cap: slack.cap * f }
  return { size, bounds, centre: [cx, cy], scale, bottom, slack: scaled, minK, maxK: Math.max(maxZoom, minK) }
}

/** Rounding slack (outline units, far under a pixel) within which a view counts as inside, so the clamp is idempotent. */
const SLACK = 1e-12

/**
 * The nearest pan/zoom inside `limits`, so the visible canvas stays inside
 * the world's outline (give or take the pan slack). The zoom is clamped to
 * `[minK, maxK]` first; then, at that zoom, a pan already inside is left exactly as it is, and any other
 * moves the shortest distance (in screen px) to one that is, so a drag into
 * the curved edge slides along it and a framing near the edge shifts as
 * little as it can.
 *
 * At a zoom the allowed pans are the centres (u, v) with `|v| <= V` and
 * `|u| <= G(|v| + b) - a` (see `FlatLimits` and `PanSlack`), a convex region
 * since G is concave. The squared distance to it, minimised over u for
 * each v, is therefore convex in v, and a ternary search on v finds the
 * nearest point.
 */
export function clampView(t: ViewTransform, limits: FlatLimits): ViewTransform {
  // Without a box to keep in view the region is never empty (see `FlatLimits`), so there is always an answer.
  return panWithin(t, limits) ?? t
}

/**
 * A screen rectangle `[[left, top], [right, bottom]]` that a box (projected at
 * zoom 1) must lie inside, as for a fit that must show a whole country.
 */
interface Keep {
  box: Bounds
  area: Bounds
}

/**
 * `clampView`, optionally also keeping `keep.box` inside `keep.area`: the
 * nearest allowed pan at the clamped zoom, or null when no pan at that zoom
 * shows the box whole. The extra condition is a rectangle of pans, so the
 * region stays convex and the same search applies; a result is always a
 * fixed point of `clampView`.
 */
function panWithin({ k, x, y }: ViewTransform, limits: FlatLimits, keep?: Keep): ViewTransform | null {
  const { size, centre: [cx, cy], scale, bottom, slack, minK, maxK } = limits
  const kk = Math.min(maxK, Math.max(minK, k))
  const halfW = size.width / 2
  const halfH = (size.height - bottom) / 2
  // The visible rectangle at zoom 1, in outline units: half-size (a, b), centre (u, v) from the outline's centre.
  const unit = kk * scale
  const a = halfW / unit
  const b = halfH / unit
  const u = ((halfW - x) / kk - cx) / scale
  const v = ((halfH - y) / kk - cy) / scale
  // The pan slack at this zoom, in outline units: none at minK, rising to the full `slack` px by SLACK_RAMP * minK.
  const ramp = Math.min(1, Math.max(0, (kk / minK - 1) / (SLACK_RAMP - 1))) / unit
  const [side, rows, cap] = [slack.side * ramp, slack.rows * ramp, slack.cap * ramp]
  const maxV = Math.max(0, Math.min(OUTLINE_HALF_HEIGHT, outlineReach(a - side) + rows, outlineReach(a - cap)) - b)
  const maxU = (row: number) => {
    const r = Math.abs(row) + b
    return Math.max(0, Math.min(outlineHalfWidth(Math.max(0, r - rows)) + side, outlineHalfWidth(r) + cap) - a)
  }
  // The pans keeping the box inside its area: u in [uLo, uHi], v in [vLo, vHi] (screen x = halfW - kk * (cx + scale * u)).
  let [uLo, uHi, vLo, vHi] = [-Infinity, Infinity, -Infinity, Infinity]
  if (keep) {
    const [[x0, y0], [x1, y1]] = keep.box
    const [[left, top], [right, down]] = keep.area
    uLo = (halfW - kk * cx + kk * x1 - right) / unit
    uHi = (halfW - kk * cx + kk * x0 - left) / unit
    vLo = (halfH - kk * cy + kk * y1 - down) / unit
    vHi = (halfH - kk * cy + kk * y0 - top) / unit
    if (uLo > uHi || vLo > vHi) return null
  }
  const uRange = (row: number): [number, number] => [Math.max(-maxU(row), uLo), Math.min(maxU(row), uHi)]
  const inside = (row: number, col: number) => {
    const [lo, hi] = uRange(row)
    return Math.abs(row) <= maxV + SLACK && row >= vLo - SLACK && row <= vHi + SLACK && col >= lo - SLACK && col <= hi + SLACK
  }
  if (inside(v, u)) return { k: kk, x, y }
  // The rows with some allowed pan: maxU falls as |row| grows, so they are |row| <= reach, cut to [vLo, vHi].
  const need = Math.max(uLo, -uHi)
  let reach = maxV
  if (need > 0) {
    if (maxU(0) < need) return null
    let [lo, hi] = [0, maxV]
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2
      if (maxU(mid) >= need) lo = mid
      else hi = mid
    }
    reach = lo
  }
  let lo = Math.max(-reach, vLo)
  let hi = Math.min(reach, vHi)
  if (lo > hi) return null
  const nearestU = (row: number) => {
    const [l, h] = uRange(row)
    return Math.min(h, Math.max(l, u))
  }
  const cost = (row: number) => (row - v) ** 2 + (nearestU(row) - u) ** 2
  for (let i = 0; i < 80 && hi - lo > SLACK; i++) {
    const m1 = lo + (hi - lo) / 3
    const m2 = hi - (hi - lo) / 3
    if (cost(m1) <= cost(m2)) hi = m2
    else lo = m1
  }
  const vv = (lo + hi) / 2
  const uu = nearestU(vv)
  return { k: kk, x: halfW - kk * (cx + scale * uu), y: halfH - kk * (cy + scale * vv) }
}

/** The widest view, "World view": the world at its smallest zoom, centred in the visible canvas. */
export function coverView(limits: FlatLimits): ViewTransform {
  const { size, centre: [cx, cy], bottom, minK } = limits
  return clampView({ k: minK, x: size.width / 2 - minK * cx, y: (size.height - bottom) / 2 - minK * cy }, limits)
}

/**
 * Carry a view across a resize: the same spot of the world stays at the
 * centre of the canvas, at the same zoom relative to the smallest zoom (`minK`).
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
 * rather than showing more than the pan slack's wedge of empty space).
 *
 * The shift must not cut the box `keep` (by default `bounds`; the fits pass
 * the country's own bounds, not the widened ones): the view is the nearest
 * allowed one that shows `keep` whole in the clear area. Near the outline's
 * slanted edge there may be none at the asked zoom (the canvas corner
 * nearest a pole binds), so the zoom steps down to the largest that has
 * one. If no zoom does (on a phone, a country so far north it sits under the
 * search band, since the top edge stays strict), it is the plain clamp at
 * the asked zoom, or a smaller zoom only if that shows clearly more.
 */
export function flatFit(
  [[x0, y0], [x1, y1]]: Bounds,
  { width, height }: Size,
  inset: MapInset,
  maxZoom: number,
  fill = 0.85,
  limits?: FlatLimits,
  keep: Bounds = [[x0, y0], [x1, y1]],
): ViewTransform {
  const w = Math.max(1, width - inset.left - inset.right)
  const h = Math.max(1, height - inset.top - inset.bottom)
  const k = Math.min(maxZoom, Math.max(1, fill / Math.max((x1 - x0) / w, (y1 - y0) / h)))
  const cx = inset.left + w / 2
  const cy = inset.top + h / 2
  const [bx, by] = [(x0 + x1) / 2, (y0 + y1) / 2]
  const at = (z: number) => ({ k: z, x: cx - z * bx, y: cy - z * by })
  if (!limits) return at(k)
  // The zoom is limited before centring, so the pan is worked out for the zoom the map will use.
  const top = Math.min(limits.maxK, Math.max(limits.minK, k))
  const area: Bounds = [[inset.left, inset.top], [width - inset.right, height - inset.bottom]]
  // The nearest view at zoom z that shows the whole of `keep` in the clear area, if any.
  const whole = (z: number) => panWithin(at(z), limits, { box: keep, area })
  const exact = whole(top)
  if (exact) return exact
  // Near the outline's edge no pan at this zoom may show it whole (the corner nearest a pole binds): step
  // the zoom out until one does, then narrow down on the largest such zoom.
  let above = top
  for (let i = 1; i <= ZOOM_STEPS; i++) {
    const z = top * Math.pow(limits.minK / top, i / ZOOM_STEPS)
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
  // It shows whole at no zoom (e.g. under the search band near a pole): the plain clamp at the asked zoom,
  // or a smaller zoom if that shows clearly more of it.
  const shown = (t: ViewTransform) => shownShare(keep, t, { width, height }, inset)
  let best = clampView(at(top), limits)
  let bestShown = shown(best)
  for (let i = 1; i <= ZOOM_STEPS; i++) {
    const t = clampView(at(top * Math.pow(limits.minK / top, i / ZOOM_STEPS)), limits)
    const seen = shown(t)
    if (seen > bestShown + 0.05) [best, bestShown] = [t, seen]
  }
  return best
}

/** Zooms tried between the requested one and minK when a box cannot be wholly shown. */
const ZOOM_STEPS = 12

/** The share of `box` (projected at zoom 1) that view `t` shows inside the clear area (the canvas less `inset`). */
export function shownShare([[x0, y0], [x1, y1]]: Bounds, t: ViewTransform, { width, height }: Size, inset: MapInset): number {
  const [X0, X1, Y0, Y1] = [t.x + t.k * x0, t.x + t.k * x1, t.y + t.k * y0, t.y + t.k * y1]
  const across = Math.max(0, Math.min(X1, width - inset.right) - Math.max(X0, inset.left))
  const down = Math.max(0, Math.min(Y1, height - inset.bottom) - Math.max(Y0, inset.top))
  const area = Math.max(1e-9, (X1 - X0) * (Y1 - Y0))
  return Math.min(1, (across * down) / area)
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
  return flatFit(widenBounds(bounds, minWidth), size, inset, maxZoom, 0.85, limits, bounds)
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
  return flatFit(widenBounds(bounds, minWidth), size, inset, maxZoom, 0.7, limits, bounds)
}

/** Where the flat map draws with a pan/zoom transform applied. */
export function flatFrame(size: Size, t: ViewTransform): { scale: number; translate: [number, number] } {
  // Only the desktop morph uses this, and it has no inset.
  const p = flatProjection(size)
  const [tx, ty] = p.translate()
  return { scale: p.scale() * t.k, translate: [tx * t.k + t.x, ty * t.k + t.y] }
}
