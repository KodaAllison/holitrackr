import { geoEqualEarthRaw } from 'd3-geo'

/**
 * The Equal Earth outline (the projected sphere's edge, i.e. the ±180°
 * meridians) as a function: its half-width at each height, at scale 1 and
 * measured from the projection's centre. The outline is symmetric about both
 * axes and convex (its half-width is a concave, decreasing function of the
 * height; the tests check this), so a rectangle lies inside it exactly when
 * its corners do.
 *
 * The rows are sampled from the equator to the pole and joined by straight
 * lines. Each chord of a concave curve lies under it, so the table is a
 * polygon just inside the true outline (by well under a pixel): anything
 * kept inside the table is inside the world.
 */
const ROWS = 256

const { heights, halfWidths } = (() => {
  const heights: number[] = []
  const halfWidths: number[] = []
  for (let i = 0; i <= ROWS; i++) {
    const [x, y] = geoEqualEarthRaw(Math.PI, (i / ROWS) * (Math.PI / 2))
    heights.push(y)
    halfWidths.push(x)
  }
  return { heights, halfWidths }
})()

/** The outline's half-height (centre to pole line), at scale 1. */
export const OUTLINE_HALF_HEIGHT = heights[ROWS]
/** The outline's half-width at the equator, at scale 1. */
export const OUTLINE_HALF_WIDTH = halfWidths[0]

/** Index i of the row segment [i, i + 1] containing `value` in the monotone `rows` (rising or falling). */
function segment(rows: readonly number[], value: number, increasing: boolean): number {
  let lo = 0
  let hi = ROWS
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if ((rows[mid] <= value) === increasing) lo = mid
    else hi = mid
  }
  return lo
}

/** Half the outline's width at height `v` from the centre (either sign), at scale 1. */
export function outlineHalfWidth(v: number): number {
  const h = Math.min(OUTLINE_HALF_HEIGHT, Math.abs(v))
  const i = segment(heights, h, true)
  const u = (h - heights[i]) / (heights[i + 1] - heights[i])
  return halfWidths[i] + u * (halfWidths[i + 1] - halfWidths[i])
}

/**
 * How far from the centre (up or down) the outline is still at least `a`
 * half-wide, at scale 1: the inverse of `outlineHalfWidth`, the pole line
 * where that is wide enough, and -1 where even the equator is too narrow.
 */
export function outlineReach(a: number): number {
  if (a <= halfWidths[ROWS]) return OUTLINE_HALF_HEIGHT
  if (a > OUTLINE_HALF_WIDTH) return -1
  const i = segment(halfWidths, a, false)
  const u = (halfWidths[i] - a) / (halfWidths[i] - halfWidths[i + 1])
  return heights[i] + u * (heights[i + 1] - heights[i])
}

/**
 * Where a ray from the centre with slope `ratio` (half-width / half-height,
 * > 0) leaves the outline, as a height at scale 1: the largest rectangle of
 * that shape centred in the outline is `2 * ratio * v` by `2 * v`.
 */
export function outlineRay(ratio: number): number {
  // Where the outline's half-width meets the ray's: halfWidths[i] - ratio * heights[i] falls through 0.
  if (halfWidths[ROWS] >= ratio * OUTLINE_HALF_HEIGHT) return OUTLINE_HALF_HEIGHT
  let lo = 0
  let hi = ROWS
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (halfWidths[mid] >= ratio * heights[mid]) lo = mid
    else hi = mid
  }
  const f0 = halfWidths[lo] - ratio * heights[lo]
  const f1 = halfWidths[hi] - ratio * heights[hi]
  return heights[lo] + (f0 / (f0 - f1)) * (heights[hi] - heights[lo])
}
