import { describe, expect, it } from 'vitest'
import { touchRow } from './useCanvasSize'

describe('touchRow', () => {
  it('is the touch row for one finger, relative to the canvas top', () => {
    expect(touchRow([{ clientY: 300 }], 64)).toBe(236)
  })

  it('is the middle of the first two fingers, as d3-zoom pinches', () => {
    expect(touchRow([{ clientY: 200 }, { clientY: 400 }], 0)).toBe(300)
  })

  it('ignores a third finger (or a touch elsewhere on the page)', () => {
    expect(touchRow([{ clientY: 200 }, { clientY: 400 }, { clientY: 900 }], 0)).toBe(300)
  })

  it('is null with no touches', () => {
    expect(touchRow([], 0)).toBeNull()
  })
})
