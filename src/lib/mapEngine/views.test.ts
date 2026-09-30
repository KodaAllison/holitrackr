import { describe, expect, it } from 'vitest'
import { geoPath } from 'd3-geo'
import { flatFit, flatProjection, NO_INSET } from './views'

const MOBILE = { width: 390, height: 844 }
const INSET = { top: 116, right: 0, bottom: 264, left: 0 }

describe('flatProjection with an inset', () => {
  it('fits the world inside the inset area, filling its width', () => {
    const [[x0, y0], [x1, y1]] = geoPath(flatProjection(MOBILE, INSET)).bounds({ type: 'Sphere' })
    expect(x0).toBeGreaterThanOrEqual(0)
    expect(x1).toBeLessThanOrEqual(390)
    expect(x1 - x0).toBeGreaterThan(370)
    expect(y0).toBeGreaterThanOrEqual(INSET.top)
    expect(y1).toBeLessThanOrEqual(844 - INSET.bottom)
    // Centred in the clear band, not the whole screen.
    expect((y0 + y1) / 2).toBeCloseTo((INSET.top + 844 - INSET.bottom) / 2, 0)
  })

  it('ignores an inset that leaves no room', () => {
    const tiny = flatProjection({ width: 100, height: 100 }, { top: 90, right: 0, bottom: 0, left: 0 })
    const full = flatProjection({ width: 100, height: 100 })
    expect(tiny.scale()).toBeCloseTo(full.scale())
  })
})

describe('flatFit', () => {
  it('centres the bounds in the inset area', () => {
    const fit = flatFit([[100, 400], [140, 420]], MOBILE, INSET, 6)
    expect(fit.k).toBe(6)
    const cx = fit.x + fit.k * 120
    const cy = fit.y + fit.k * 410
    expect(cx).toBeCloseTo(195)
    expect(cy).toBeCloseTo((116 + 580) / 2)
  })

  it('never zooms out past the whole map', () => {
    expect(flatFit([[0, 0], [1000, 1000]], MOBILE, NO_INSET, 6).k).toBe(1)
  })
})
