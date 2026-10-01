import { describe, expect, it } from 'vitest'
import { insideBounds, LABEL_GAP, LABEL_PAD, onNearSide, placeLabel } from './selectedLabel'

const BOUNDS = { left: 0, top: 0, right: 1000, bottom: 800 }
const BOX = { width: 60, height: 26 }

describe('onNearSide', () => {
  it('is true for the point facing the viewer', () => {
    expect(onNearSide([12, 42], [12, 42])).toBe(true)
  })

  it('is false for the antipode and for points just past the horizon', () => {
    expect(onNearSide([-168, -42], [12, 42])).toBe(false)
    expect(onNearSide([91, 0], [0, 0])).toBe(false)
  })

  it('hides points within the margin of the horizon', () => {
    expect(onNearSide([88, 0], [0, 0])).toBe(false)
    expect(onNearSide([88, 0], [0, 0], 0)).toBe(true)
    expect(onNearSide([80, 0], [0, 0])).toBe(true)
  })
})

describe('insideBounds', () => {
  it('includes the edges and excludes points past them', () => {
    expect(insideBounds([0, 0], BOUNDS)).toBe(true)
    expect(insideBounds([1000, 800], BOUNDS)).toBe(true)
    expect(insideBounds([-1, 400], BOUNDS)).toBe(false)
    expect(insideBounds([500, 801], BOUNDS)).toBe(false)
  })
})

describe('placeLabel', () => {
  it('sits to the right of the anchor, vertically centred', () => {
    expect(placeLabel([400, 400], BOX, BOUNDS)).toEqual({ x: 400 + LABEL_GAP, y: 400 - 13, side: 'right' })
  })

  it('is hidden without an anchor or with one off-screen', () => {
    expect(placeLabel(null, BOX, BOUNDS)).toBeNull()
    expect(placeLabel([-5, 400], BOX, BOUNDS)).toBeNull()
    expect(placeLabel([400, 900], BOX, BOUNDS)).toBeNull()
    expect(placeLabel([NaN, 400], BOX, BOUNDS)).toBeNull()
  })

  it('flips to the left near the right edge', () => {
    expect(placeLabel([960, 400], BOX, BOUNDS)).toEqual({ x: 960 - LABEL_GAP - 60, y: 387, side: 'left' })
  })

  it('stays on the right near the left edge', () => {
    expect(placeLabel([4, 400], BOX, BOUNDS)?.side).toBe('right')
  })

  it('clamps vertically near the top and bottom edges', () => {
    expect(placeLabel([400, 2], BOX, BOUNDS)?.y).toBe(LABEL_PAD)
    expect(placeLabel([400, 798], BOX, BOUNDS)?.y).toBe(800 - LABEL_PAD - 26)
  })

  it('keeps inside a narrow band, clamping when neither side fits', () => {
    const narrow = { left: 0, top: 0, right: 100, bottom: 100 }
    const p = placeLabel([50, 50], BOX, narrow)
    expect(p).not.toBeNull()
    expect(p?.x).toBeGreaterThanOrEqual(LABEL_PAD)
    expect((p?.x ?? 0) + BOX.width).toBeLessThanOrEqual(100 - LABEL_PAD)
  })

  it('respects inset bounds (the mobile visible band)', () => {
    const band = { left: 0, top: 116, right: 390, bottom: 580 }
    expect(placeLabel([200, 100], BOX, band)).toBeNull()
    expect(placeLabel([200, 120], BOX, band)?.y).toBe(116 + LABEL_PAD)
  })

  it('is hidden when the bounds are too small for the label', () => {
    expect(placeLabel([10, 10], BOX, { left: 0, top: 0, right: 40, bottom: 40 })).toBeNull()
  })
})
