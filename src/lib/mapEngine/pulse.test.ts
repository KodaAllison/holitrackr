import { describe, expect, it } from 'vitest'
import { PULSE_MS, pulseRings } from './pulse'

describe('pulseRings', () => {
  it('starts with one small, strong ring', () => {
    const [ring, ...rest] = pulseRings(0)
    expect(rest).toEqual([])
    expect(ring.radius).toBe(6)
    expect(ring.alpha).toBeCloseTo(0.8)
  })

  it('staggers a second ring while the first is still growing', () => {
    const rings = pulseRings(PULSE_MS * 0.5)
    expect(rings).toHaveLength(2)
    expect(rings[0].radius).toBeGreaterThan(rings[1].radius)
    expect(rings[0].alpha).toBeLessThan(rings[1].alpha)
  })

  it('has faded out by the end', () => {
    for (const ring of pulseRings(PULSE_MS)) expect(ring.alpha).toBeCloseTo(0)
    expect(pulseRings(PULSE_MS * 0.99).every(ring => ring.alpha < 0.05)).toBe(true)
  })
})
