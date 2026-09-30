/**
 * Geometry for the sign-in "atlas plate": where the globe sits, where the
 * headline ring runs, and where the tour callout's label can go without
 * running into that ring. Pure maths; `drawSignIn` does the drawing.
 */

export interface SignInLayout {
  cx: number
  cy: number
  radius: number
  /** Top of the call to action (headline + Continue with Google) below the globe. */
  ctaTop: number
}

/** Globe geometry for the viewport: centred, with room below for the call to action. */
export function signInLayout(width: number, height: number): SignInLayout {
  const top = 72
  const area = Math.max(200, height - top - 250)
  const radius = Math.round(Math.max(80, Math.min(250, area / 2 - 50, width / 2 - 64)))
  const cy = top + area / 2
  return { cx: width / 2, cy, radius, ctaTop: cy + radius + (radius < 160 ? 56 : 76) }
}

/** Small globes get a tighter ring, smaller type and a compact callout. */
export const isCompact = (radius: number) => radius < 160

/** The orbiting headline: the radius its letters are centred on, and their size. */
export function orbitGeometry(radius: number) {
  const compact = isCompact(radius)
  return { radius: radius + (compact ? 34 : 44), fontSize: compact ? 10 : 12 }
}

/** Distance from the globe's centre that the callout label must stay beyond to clear the ring's letters. */
export function ringClearance(radius: number, pad = 6) {
  const { radius: r, fontSize } = orbitGeometry(radius)
  // Letters are centred on the ring and turned to it, so they reach about
  // three quarters of the font size either side of it.
  return r + fontSize * 0.75 + pad
}

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

/** The label's size, measured from its elbow: `above` and `below` the leader's end, `width` across. */
export interface LabelBox {
  width: number
  above: number
  below: number
}

export interface CalloutInput {
  /** The country's projected anchor on screen. */
  point: [number, number]
  cx: number
  cy: number
  /** How far from the centre the leader naturally bends. */
  reach: number
  /** Length of the leader's horizontal run to the label. */
  run: number
  /** Space between the leader's end and the text. */
  textGap: number
  /** Radius the label must stay outside of (see `ringClearance`). */
  clearance: number
  label: LabelBox
  /** Where the label may go: inside the viewport and clear of the page chrome. */
  bounds: Rect
}

export interface CalloutPlacement {
  /** Where the leader bends. */
  elbow: [number, number]
  /** Where the leader's horizontal run ends, next to the text. */
  lineEndX: number
  /** Text x: its left edge when aligned left, its right edge when aligned right. */
  textX: number
  align: 'left' | 'right'
  /** The label's box on screen. */
  rect: Rect
  /** No clear spot fitted: draw a backing plate so the label masks the ring. */
  plate: boolean
}

/** Nearest distance from (x, y) to the rectangle (0 when inside it). */
function distanceToRect(x: number, y: number, r: Rect) {
  const dx = Math.max(r.left - x, 0, x - r.right)
  const dy = Math.max(r.top - y, 0, y - r.bottom)
  return Math.hypot(dx, dy)
}

/** Whether a rectangle keeps entirely outside the circle of radius `r` round (cx, cy). */
export function rectClearsCircle(rect: Rect, cx: number, cy: number, r: number) {
  return distanceToRect(cx, cy, rect) >= r - 1e-6
}

const clamp = (v: number, lo: number, hi: number) => (lo > hi ? lo : Math.min(hi, Math.max(lo, v)))

/**
 * Places the tour callout: a leader from the country out past the ring to a
 * label beside it. The label never overlaps the ring's letters. It goes, in
 * order of preference:
 * 1. beside the leader's natural bend, pushed outwards until it clears the ring
 *    (or pulled in from the viewport's edge while it still does);
 * 2. above or below the ring (whichever is on the country's side first), for
 *    viewports too narrow to fit it beside;
 * 3. failing both, at the natural spot with `plate` set, so it masks the ring.
 */
export function placeCallout(input: CalloutInput): CalloutPlacement {
  const { point, cx, cy, reach, run, textGap, clearance, label, bounds } = input
  const dx = point[0] - cx
  const dy = point[1] - cy
  const angle = Math.hypot(dx, dy) < 20 ? -0.6 : Math.atan2(dy, dx)
  const side = Math.cos(angle) >= 0 ? 1 : -1
  const align = side > 0 ? 'left' : 'right'
  const naturalX = cx + Math.cos(angle) * reach + side * (run + textGap)

  const make = (textX: number, ey: number, plate: boolean): CalloutPlacement => {
    const lineEndX = textX - side * textGap
    const left = side > 0 ? textX : textX - label.width
    return {
      elbow: [lineEndX - side * run, ey],
      lineEndX,
      textX,
      align,
      rect: { left, right: left + label.width, top: ey - label.above, bottom: ey + label.below },
      plate,
    }
  }
  const fits = (p: CalloutPlacement) =>
    p.rect.left >= bounds.left - 1e-6 && p.rect.right <= bounds.right + 1e-6 &&
    p.rect.top >= bounds.top - 1e-6 && p.rect.bottom <= bounds.bottom + 1e-6 &&
    rectClearsCircle(p.rect, cx, cy, clearance)

  // 1. Beside the bend, pushed out horizontally until the label clears the ring.
  const ey = clamp(cy + Math.sin(angle) * reach, bounds.top + label.above, bounds.bottom - label.below)
  const top = ey - label.above
  const bottom = ey + label.below
  const nearestDy = cy < top ? top - cy : cy > bottom ? cy - bottom : 0
  const needX = Math.sqrt(Math.max(0, clearance * clearance - nearestDy * nearestDy))
  // Pull it back in from the viewport's edge too, as long as it stays clear.
  const besideX = side > 0
    ? clamp(Math.min(naturalX, bounds.right - label.width), cx + needX, Infinity)
    : clamp(Math.max(naturalX, bounds.left + label.width), -Infinity, cx - needX)
  const beside = make(besideX, ey, false)
  if (fits(beside)) return beside

  // 2. Above or below the ring, kept inside the viewport horizontally.
  const clampedX = side > 0
    ? clamp(naturalX, bounds.left, bounds.right - label.width)
    : clamp(naturalX, bounds.left + label.width, bounds.right)
  const above = make(clampedX, cy - clearance - label.below, false)
  const below = make(clampedX, cy + clearance + label.above, false)
  for (const p of Math.sin(angle) < 0 ? [above, below] : [below, above]) {
    if (fits(p)) return p
  }

  // 3. Nowhere clear: stay by the country, inside the viewport, over a plate.
  return make(clampedX, ey, true)
}

/**
 * The sign-in screen's callout for a country projected at `point`, with the
 * screen's own leader lengths and the page chrome it must keep clear of (the
 * logo and strapline above, the call to action below).
 */
export function placeSignInCallout(point: [number, number], layout: SignInLayout, width: number, label: LabelBox) {
  const { cx, cy, radius, ctaTop } = layout
  const compact = isCompact(radius)
  return placeCallout({
    point, cx, cy, label,
    reach: radius + (compact ? 34 : 70),
    run: compact ? 12 : 28,
    textGap: 10,
    clearance: ringClearance(radius),
    bounds: { left: 12, right: width - 12, top: compact ? 60 : 92, bottom: ctaTop - 16 },
  })
}
