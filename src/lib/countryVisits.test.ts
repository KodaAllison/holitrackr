import { describe, expect, it } from 'vitest'
import type { VisitedCountry } from '../types'
import {
  isPendingVisit,
  sortVisits,
  toVisit,
  visitValuesOf,
  withVisitAdded,
  withVisitRemoved,
  withVisitReplaced,
} from './countryVisits'

const spain: VisitedCountry = {
  code: 'ESP', name: 'Spain', status: 'visited', visitedAt: '2015-07',
  visits: [{ id: 3, visitedAt: '2023-01' }],
}
const japan: VisitedCountry = { code: 'JPN', name: 'Japan', status: 'visited' }
const values = { notes: 'Again', place: '  ', visitedAt: '2019-03', rating: undefined, tags: ['Food'] }

describe('country visit list updates', () => {
  it('builds a visit from form values and back', () => {
    const visit = toVisit(7, values)
    expect(visit).toEqual({ id: 7, visitedAt: '2019-03', notes: 'Again', tags: ['Food'] })
    expect(visitValuesOf(visit)).toEqual({ notes: 'Again', place: '', visitedAt: '2019-03', rating: undefined, tags: ['Food'] })
    expect(visitValuesOf({ id: 1, visitedAt: '2020-01' })).toEqual({ notes: '', place: '', visitedAt: '2020-01', rating: undefined, tags: [] })
  })

  it('sorts visits oldest first, then by id', () => {
    expect(sortVisits([
      { id: 5, visitedAt: '2020-01' }, { id: 2, visitedAt: '2020-01' }, { id: 9, visitedAt: '2018-12' },
    ]).map(v => v.id)).toEqual([9, 2, 5])
  })

  it('adds a visit to its country only, in date order', () => {
    const next = withVisitAdded([spain, japan], spain, toVisit(-1, values))
    expect(next[0].visits?.map(v => v.id)).toEqual([-1, 3])
    expect(next[1]).toBe(japan)
    expect(withVisitAdded([japan], japan, toVisit(4, values))[0].visits).toHaveLength(1)
  })

  it('replaces a visit by id (pending → stored, or an edit) and re-sorts', () => {
    const pending = withVisitAdded([spain], spain, toVisit(-1, values))
    const stored = withVisitReplaced(pending, -1, toVisit(12, values))
    expect(stored[0].visits?.map(v => v.id)).toEqual([12, 3])
    const moved = withVisitReplaced(stored, 12, toVisit(12, { ...values, visitedAt: '2024-05' }))
    expect(moved[0].visits?.map(v => v.id)).toEqual([3, 12])
    expect(withVisitReplaced([spain, japan], 99, toVisit(99, values))).toEqual([spain, japan])
  })

  it('removes a visit and drops an emptied list', () => {
    const next = withVisitRemoved([spain, japan], 3)
    expect(next[0]).toEqual({ code: 'ESP', name: 'Spain', status: 'visited', visitedAt: '2015-07' })
    expect(next[0]).not.toHaveProperty('visits')
    expect(next[1]).toBe(japan)
  })

  it('treats negative ids as pending', () => {
    expect(isPendingVisit(-1)).toBe(true)
    expect(isPendingVisit(1)).toBe(false)
  })
})
