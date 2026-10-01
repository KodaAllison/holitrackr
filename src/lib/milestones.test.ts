import { describe, expect, it } from 'vitest'
import type { VisitedCountry } from '../types'
import { detectMilestone, milestoneMessage } from './milestones'

const v = (code: string, name: string, status: VisitedCountry['status'] = 'visited'): VisitedCountry => ({ code, name, status })
const europe9 = ['ESP:Spain', 'ITA:Italy', 'DEU:Germany', 'PRT:Portugal', 'GRC:Greece', 'AUT:Austria', 'BEL:Belgium', 'NLD:Netherlands', 'IRL:Ireland']
  .map(s => { const [code, name] = s.split(':'); return v(code, name) })

describe('detectMilestone', () => {
  it('celebrates the 10th visited country', () => {
    const country = v('POL', 'Poland')
    const m = detectMilestone(europe9, [...europe9, country], country)
    expect(m).toMatchObject({ kind: 'count', count: 10, id: 'count-10' })
  })

  it('celebrates the first country on a new continent', () => {
    const before = europe9.slice(0, 3)
    const country = v('JPN', 'Japan')
    expect(detectMilestone(before, [...before, country], country)).toMatchObject({ kind: 'continent', continent: 'Asia' })
  })

  it('prefers the count milestone when both happen', () => {
    const country = v('JPN', 'Japan')
    expect(detectMilestone(europe9, [...europe9, country], country)?.kind).toBe('count')
  })

  it('ignores bucket-list marks, repeats and the very first country', () => {
    const peru = v('PER', 'Peru', 'bucketlist')
    expect(detectMilestone(europe9, [...europe9, peru], peru)).toBeNull()
    expect(detectMilestone(europe9, europe9, europe9[0])).toBeNull()
    const first = v('JPN', 'Japan')
    expect(detectMilestone([], [first], first)).toBeNull()
  })

  it('counts a bucket-list country moving to visited', () => {
    const before = [...europe9, v('POL', 'Poland', 'bucketlist')]
    const after = [...europe9, v('POL', 'Poland')]
    expect(detectMilestone(before, after, { code: 'POL', name: 'Poland' })?.id).toBe('count-10')
  })
})

describe('milestoneMessage', () => {
  it('reads naturally', () => {
    expect(milestoneMessage({ id: 'count-10', kind: 'count', count: 10, country: { code: 'POL', name: 'Poland' } }))
      .toBe('10 countries! Poland was number 10.')
    expect(milestoneMessage({ id: 'continent-Asia', kind: 'continent', continent: 'Asia', country: { code: 'JPN', name: 'Japan' } }))
      .toBe('First time in Asia: Japan.')
  })
})
