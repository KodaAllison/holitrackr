import { geoDistance } from 'd3-geo'

/**
 * Pure maths for the selected country's name label on the map: whether its
 * anchor can be seen, and where the label goes so it stays inside the map.
 */

export type Point = [number, number]

export interface LabelBox {
  width: number
  height: number
}

/** The area the label must stay inside, in container px. */
export interface LabelBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface LabelPlacement {
  x: number
  y: number
  side: 'right' | 'left'
}

/** Gap between the anchor and the label's near edge. */
export const LABEL_GAP = 12
/** Space kept between the label and the bounds. */
export const LABEL_PAD = 8
/**
 * The globe hides the label a little before its anchor reaches the horizon
 * (radians, ~3°), so it never hangs off the rim.
 */
export const HORIZON_MARGIN = 0.05

/** Whether a [lon, lat] point is on the globe's near side, facing `facing`. */
export function onNearSide(point: Point, facing: Point, margin = HORIZON_MARGIN): boolean {
  return geoDistance(point, facing) < Math.PI / 2 - margin
}

/** Whether a screen point is inside the bounds. */
export function insideBounds([x, y]: Point, b: LabelBounds): boolean {
  return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom
}

/**
 * Where the label's top-left goes: to the right of the anchor, vertically
 * centred on it, flipping to the left when the right side would run past
 * the bounds, and clamped inside them. Null when there is no anchor or it
 * is outside the bounds (off-screen, or under floating UI).
 */
export function placeLabel(
  anchor: Point | null,
  box: LabelBox,
  bounds: LabelBounds,
  gap = LABEL_GAP,
  pad = LABEL_PAD,
): LabelPlacement | null {
  if (!anchor || !Number.isFinite(anchor[0]) || !Number.isFinite(anchor[1])) return null
  if (!insideBounds(anchor, bounds)) return null
  const [ax, ay] = anchor
  const minX = bounds.left + pad
  const maxX = bounds.right - pad - box.width
  const minY = bounds.top + pad
  const maxY = bounds.bottom - pad - box.height
  if (maxX < minX || maxY < minY) return null

  const right = ax + gap
  const left = ax - gap - box.width
  let side: LabelPlacement['side'] = 'right'
  let x = right
  if (right > maxX) {
    // Flip to the left, unless that runs out of room even further.
    if (left >= minX || minX - left < right - maxX) {
      side = 'left'
      x = left
    }
  }
  x = Math.min(maxX, Math.max(minX, x))
  const y = Math.min(maxY, Math.max(minY, ay - box.height / 2))
  return { x, y, side }
}
