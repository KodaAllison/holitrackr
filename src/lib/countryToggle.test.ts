import { describe, expect, it } from 'vitest'
import type { VisitedCountry } from '../types'
import { planCountryToggle } from './countryToggle'

const v = (code: string, name: string, status: VisitedCountry['status'] = 'visited'): VisitedCountry => ({ code, name, status })
const europe9 = ['ESP:Spain', 'ITA:Italy', 'DEU:Germany', 'PRT:Portugal', 'GRC:Greece', 'AUT:Austria', 'BEL:Belgium', 'NLD:Netherlands', 'IRL:Ireland']
  .map(s => { const [code, name] = s.split(':'); return v(code, name) })
const poland = { code: 'POL', name: 'Poland' }

describe('planCountryToggle', () => {
  it('derives the next list, the save and the milestone from the same list', () => {
    const plan = planCountryToggle(europe9, poland)
    expect(plan.next).toEqual([...europe9, v('POL', 'Poland')])
    expect(plan.action).toEqual({ type: 'upsert', status: 'visited' })
    expect(plan.previous).toBeUndefined()
    expect(plan.milestone?.id).toBe('count-10')
  })

  it('plans a second rapid click from the first click\'s result, not the original list', () => {
    const first = planCountryToggle(europe9, poland)
    const second = planCountryToggle(first.next, poland)
    expect(second.previous).toBe('visited')
    expect(second.action).toEqual({ type: 'upsert', status: 'bucketlist' })
    expect(second.next).toEqual([...europe9, v('POL', 'Poland', 'bucketlist')])
    // Moving off "visited" is not a milestone, even though the original list would say so.
    expect(second.milestone).toBeNull()
  })

  it('reports the previous status and a remove when cycling off the bucket list', () => {
    const before = [...europe9, v('POL', 'Poland', 'bucketlist')]
    const plan = planCountryToggle(before, poland)
    expect(plan.previous).toBe('bucketlist')
    expect(plan.action).toEqual({ type: 'remove' })
    expect(plan.next).toEqual(europe9)
    expect(plan.milestone).toBeNull()
  })

  it('honours an explicit status', () => {
    const plan = planCountryToggle(europe9, poland, 'bucketlist')
    expect(plan.action).toEqual({ type: 'upsert', status: 'bucketlist' })
    expect(plan.milestone).toBeNull()
  })

  it('does not mutate the list it plans from', () => {
    const before = structuredClone(europe9)
    planCountryToggle(europe9, poland)
    expect(europe9).toEqual(before)
  })
})
