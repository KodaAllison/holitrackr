import { describe, expect, it } from 'vitest'
import { introAt, planIntro, SPIN_MS } from './introTimeline'

const target: [number, number] = [-15, -25]

describe('planIntro', () => {
  it('staggers fills but caps the total, however many countries there are', () => {
    const few = planIntro(5)
    const many = planIntro(150)
    expect(few.fillStart(1) - few.fillStart(0)).toBe(70)
    expect(many.fillStart(149) - many.fillStart(0)).toBeCloseTo(1200)
    expect(many.duration).toBeLessThan(3500)
  })

  it('settles no earlier than the spin ends', () => {
    expect(planIntro(0).settleStart).toBe(SPIN_MS)
  })
})

describe('introAt', () => {
  const plan = planIntro(10)

  it('starts dark, small and spun away', () => {
    const s = introAt(plan, 0, target)
    expect(s.light).toBe(0)
    expect(s.scale).toBeCloseTo(0.72)
    expect(s.rotate[0]).toBeGreaterThan(target[0] + 100)
    expect(s.fill(0)).toBe(0)
  })

  it('ends exactly on the interactive globe', () => {
    const s = introAt(plan, plan.duration, target)
    expect(s.done).toBe(true)
    expect(s.light).toBe(1)
    expect(s.scale).toBe(1)
    expect(s.rotate).toEqual(target)
    expect(s.fill(9)).toBe(1)
  })

  it('lights countries up one after another', () => {
    const s = introAt(plan, plan.fillStart(3) + 100, target)
    expect(s.fill(2)).toBeGreaterThan(s.fill(3))
    expect(s.fill(5)).toBe(0)
  })
})
