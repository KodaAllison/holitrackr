import { readFileSync } from 'node:fs'
import { geoDistance, geoOrthographic } from 'd3-geo'
import { describe, expect, it } from 'vitest'
import { decodeWorld } from './worldAtlas'
import { buildCountryIndex } from './mapEngine/countryIndex'
import { buildTour, STEP_SECONDS, tourAt } from './signInTour'
import {
  type CalloutInput,
  isCompact,
  orbitGeometry,
  placeCallout,
  placeSignInCallout,
  rectClearsCircle,
  ringClearance,
  signInLayout,
} from './signInCallout'

const base: CalloutInput = {
  point: [0, 0], cx: 500, cy: 400, reach: 300, run: 28, textGap: 10, clearance: 290,
  label: { width: 200, above: 22, below: 60 },
  bounds: { left: 12, top: 90, right: 1428, bottom: 660 },
}

describe('rectClearsCircle', () => {
  it('measures to the nearest point of the rectangle', () => {
    expect(rectClearsCircle({ left: 110, right: 200, top: -10, bottom: 10 }, 0, 0, 100)).toBe(true)
    expect(rectClearsCircle({ left: 90, right: 200, top: -10, bottom: 10 }, 0, 0, 100)).toBe(false)
    // A corner near the diagonal: 80,80 is ~113 from the centre.
    expect(rectClearsCircle({ left: 80, right: 200, top: 80, bottom: 200 }, 0, 0, 100)).toBe(true)
    expect(rectClearsCircle({ left: -10, right: 10, top: -10, bottom: 10 }, 0, 0, 5)).toBe(false)
  })
})

describe('placeCallout', () => {
  it('keeps the natural spot when it already clears the ring', () => {
    const p = placeCallout({ ...base, point: [650, 400] })
    expect(p.align).toBe('left')
    expect(p.elbow).toEqual([800, 400])
    expect(p.textX).toBe(838)
    expect(p.plate).toBe(false)
  })

  it('pushes a label near the top of the ring outwards until it clears it', () => {
    // A country straight up: the natural label would sit on the ring's crown.
    const p = placeCallout({ ...base, point: [520, 250] })
    expect(p.plate).toBe(false)
    expect(rectClearsCircle(p.rect, base.cx, base.cy, base.clearance)).toBe(true)
    expect(p.rect.top).toBeGreaterThanOrEqual(base.bounds.top)
    // The leader's horizontal run still reaches the text.
    expect(p.lineEndX).toBe(p.textX - base.textGap)
    expect(p.elbow[0]).toBe(p.lineEndX - base.run)
  })

  it('mirrors to the left for countries on the left', () => {
    const p = placeCallout({ ...base, point: [380, 300] })
    expect(p.align).toBe('right')
    expect(p.rect.right).toBe(p.textX)
    expect(p.lineEndX).toBe(p.textX + base.textGap)
    expect(rectClearsCircle(p.rect, base.cx, base.cy, base.clearance)).toBe(true)
  })

  it('goes above the ring when it cannot fit beside it', () => {
    const narrow: CalloutInput = {
      ...base, cx: 195, cy: 333, reach: 165, run: 12, clearance: 178,
      label: { width: 140, above: 13, below: 41 },
      bounds: { left: 12, top: 60, right: 378, bottom: 504 },
      point: [290, 300],
    }
    const p = placeCallout(narrow)
    expect(p.plate).toBe(false)
    expect(p.rect.bottom).toBeLessThanOrEqual(narrow.cy - narrow.clearance)
    expect(p.rect.right).toBeLessThanOrEqual(narrow.bounds.right)
  })

  it('falls back to a plate when nothing clears the ring', () => {
    const p = placeCallout({
      ...base, cx: 150, cy: 150, reach: 120, clearance: 140,
      bounds: { left: 0, top: 0, right: 300, bottom: 300 }, point: [200, 150],
    })
    expect(p.plate).toBe(true)
    expect(p.rect.left).toBeGreaterThanOrEqual(0)
    expect(p.rect.right).toBeLessThanOrEqual(300)
  })
})

describe('signInLayout', () => {
  it('keeps the call to action below the ring', () => {
    for (const [w, h] of [[1440, 900], [1280, 800], [1024, 768], [390, 844]]) {
      const l = signInLayout(w, h)
      expect(l.ctaTop).toBeGreaterThan(l.cy + ringClearance(l.radius))
    }
  })

  it('uses the compact ring on phones', () => {
    const l = signInLayout(390, 844)
    expect(isCompact(l.radius)).toBe(true)
    expect(orbitGeometry(l.radius)).toEqual({ radius: l.radius + 34, fontSize: 10 })
  })
})

// The whole demo tour, as the sign-in screen draws it, at the sizes we ship for.
describe('placeSignInCallout over the tour', () => {
  const world = decodeWorld(JSON.parse(readFileSync(new URL('../data/world-motion.topo.json', import.meta.url), 'utf8')))
  const stops = buildTour(buildCountryIndex(world))
  const viewports: [number, number][] = [[1440, 900], [1280, 800], [1024, 768], [390, 844]]

  for (const [w, h] of viewports) {
    it(`keeps every stop's label clear of the ring at ${w}x${h}`, () => {
      const layout = signInLayout(w, h)
      const compact = isCompact(layout.radius)
      // Generous label sizes: wider than the longest demo name renders.
      const label = compact ? { width: 170, above: 13, below: 41 } : { width: 250, above: 22, below: 60 }
      const clearance = ringClearance(layout.radius)
      let checked = 0
      stops.forEach((stop, i) => {
        // Every moment the callout shows for this stop.
        for (let phase = 0.08; phase <= 0.62; phase += 0.02) {
          const moment = tourAt(stops, STEP_SECONDS * (i + phase), false)
          if (moment.calloutAlpha <= 0) continue
          const projection = geoOrthographic().translate([layout.cx, layout.cy]).scale(layout.radius).rotate(moment.rotate).clipAngle(90)
          if (geoDistance(stop.country.anchor, [-moment.rotate[0], -moment.rotate[1]]) >= 1.45) continue
          const point = projection(stop.country.anchor)
          if (!point) continue
          const p = placeSignInCallout(point, layout, w, label)
          expect(p.plate, `${stop.country.identity.name} at ${w}x${h}`).toBe(false)
          expect(rectClearsCircle(p.rect, layout.cx, layout.cy, clearance)).toBe(true)
          expect(p.rect.left).toBeGreaterThanOrEqual(12)
          expect(p.rect.right).toBeLessThanOrEqual(w - 12)
          expect(p.rect.bottom).toBeLessThanOrEqual(layout.ctaTop - 16)
          checked++
        }
      })
      expect(checked).toBeGreaterThan(stops.length * 10)
    })
  }

  it('keeps the reduced-motion still frame clear too', () => {
    const moment = tourAt(stops, 0, true)
    const layout = signInLayout(1440, 900)
    const projection = geoOrthographic().translate([layout.cx, layout.cy]).scale(layout.radius).rotate(moment.rotate).clipAngle(90)
    const point = projection(stops[moment.index].country.anchor)
    expect(point).not.toBeNull()
    if (!point) return
    const p = placeSignInCallout(point, layout, 1440, { width: 250, above: 22, below: 60 })
    expect(p.plate).toBe(false)
    expect(rectClearsCircle(p.rect, layout.cx, layout.cy, ringClearance(layout.radius))).toBe(true)
  })
})
