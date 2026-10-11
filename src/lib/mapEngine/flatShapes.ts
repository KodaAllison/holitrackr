import { geoPath } from 'd3-geo'
import type { IndexedCountry } from './countryIndex'
import { traceFlat } from './flatTrace'
import { ShapeCache } from './renderer'
import { projectionAt, type FlatLimits } from './views'

/**
 * Each country's size (largest projected dimension, px at zoom 1) on the
 * flat map turned to face it, so the size never includes a jump across the
 * antimeridian. Worked out on first use and kept for these limits.
 */
export function flatSizes(limits: FlatLimits): (c: IndexedCountry) => number {
  const sizes = new WeakMap<IndexedCountry, number>()
  return c => {
    let size = sizes.get(c)
    if (size === undefined) {
      const [[x0, y0], [x1, y1]] = geoPath(projectionAt(limits, c.anchor[0])).bounds(c.feature)
      size = Math.max(x1 - x0, y1 - y0)
      sizes.set(c, size)
    }
    return size
  }
}

/** The flat map's shapes with `lon` down the middle: traced on the fast path, through d3 where the antimeridian cuts a country. */
export function flatShapes(limits: FlatLimits, lon: number, sizeOf: (c: IndexedCountry) => number): ShapeCache {
  const { scale, centre } = limits
  return new ShapeCache(projectionAt(limits, lon), undefined, undefined, {
    trace: (c, fill, stroke) => traceFlat(c.feature.geometry, lon, scale, centre, fill, stroke),
    sizeOf,
  })
}
