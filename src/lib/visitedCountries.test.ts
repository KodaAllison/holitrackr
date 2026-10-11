import { describe, expect, it } from 'vitest'
import type { VisitedCountry } from '../types/country'
import { nextVisitedState, withStatusAction } from './visitedCountries'

const spain = { code: 'ESP', name: 'Spain' }
const france = { code: '-99', name: 'France' }
const norway = { code: '-99', name: 'Norway' }

describe('nextVisitedState map-click cycle', () => {
  it('adds an absent country as visited', () => {
    expect(nextVisitedState([], spain)).toEqual({
      next: [{ ...spain, status: 'visited' }],
      action: { type: 'upsert', status: 'visited' },
    })
  })

  it('moves a visited country to the bucket list, keeping journal fields', () => {
    const prev: VisitedCountry[] = [
      { ...spain, status: 'visited', notes: 'Summer', visitedAt: '2026-08', rating: 5, tags: ['food'] },
    ]
    expect(nextVisitedState(prev, spain)).toEqual({
      next: [{ ...spain, status: 'bucketlist', notes: 'Summer', visitedAt: '2026-08', rating: 5, tags: ['food'] }],
      action: { type: 'upsert', status: 'bucketlist' },
    })
  })

  it('removes a bucket-list country', () => {
    const prev: VisitedCountry[] = [{ ...spain, status: 'bucketlist' }]
    expect(nextVisitedState(prev, spain)).toEqual({ next: [], action: { type: 'remove' } })
  })
})

describe('nextVisitedState with an explicit status', () => {
  it('adds an absent country with that status', () => {
    expect(nextVisitedState([], spain, 'bucketlist')).toEqual({
      next: [{ ...spain, status: 'bucketlist' }],
      action: { type: 'upsert', status: 'bucketlist' },
    })
  })

  it('switches a country with a different status in place', () => {
    const prev: VisitedCountry[] = [
      { ...france, status: 'visited' },
      { ...spain, status: 'bucketlist', notes: 'Someday' },
    ]
    expect(nextVisitedState(prev, spain, 'visited')).toEqual({
      next: [
        { ...france, status: 'visited' },
        { ...spain, status: 'visited', notes: 'Someday' },
      ],
      action: { type: 'upsert', status: 'visited' },
    })
  })

  it('removes a country that already has that status', () => {
    const prev: VisitedCountry[] = [{ ...spain, status: 'visited' }]
    expect(nextVisitedState(prev, spain, 'visited')).toEqual({ next: [], action: { type: 'remove' } })
  })
})

describe('nextVisitedState identity and purity', () => {
  it('keys on code and name, so shared -99 codes stay distinct', () => {
    const prev: VisitedCountry[] = [{ ...france, status: 'visited' }]
    expect(nextVisitedState(prev, norway)).toEqual({
      next: [{ ...france, status: 'visited' }, { ...norway, status: 'visited' }],
      action: { type: 'upsert', status: 'visited' },
    })
  })

  it('does not mutate the previous list', () => {
    const prev: VisitedCountry[] = [{ ...spain, status: 'visited' }]
    const snapshot = structuredClone(prev)
    nextVisitedState(prev, spain)
    nextVisitedState(prev, spain, 'visited')
    nextVisitedState(prev, france)
    expect(prev).toEqual(snapshot)
  })
})

describe('withStatusAction', () => {
  it('upserts in place, keeping the journal and visits', () => {
    const prev: VisitedCountry[] = [
      { ...spain, status: 'bucketlist', notes: 'Someday', rating: 4, visits: [{ id: 7, visitedAt: '2025-05' }] },
    ]
    expect(withStatusAction(prev, spain, { type: 'upsert', status: 'visited' })).toEqual([
      { ...spain, status: 'visited', notes: 'Someday', rating: 4, visits: [{ id: 7, visitedAt: '2025-05' }] },
    ])
  })

  it('applies to a list that changed since the plan, keeping the newer entries', () => {
    // Planned from a list where France's new visit was still pending (-1);
    // by the time the updater runs it has its stored id.
    const plannedFrom: VisitedCountry[] = [{ ...france, status: 'visited', visits: [{ id: -1, visitedAt: '2026-01' }] }]
    const { action } = nextVisitedState(plannedFrom, spain)
    const prev: VisitedCountry[] = [{ ...france, status: 'visited', visits: [{ id: 42, visitedAt: '2026-01' }] }]
    expect(withStatusAction(prev, spain, action)).toEqual([
      { ...france, status: 'visited', visits: [{ id: 42, visitedAt: '2026-01' }] },
      { ...spain, status: 'visited' },
    ])
  })

  it('is idempotent, so a Retry can replay it after the save did land', () => {
    const upsert = { type: 'upsert', status: 'visited' } as const
    const once = withStatusAction([], spain, upsert)
    // An explicit-status re-toggle here would plan a remove; the action keeps the country.
    expect(withStatusAction(once, spain, upsert)).toEqual(once)
    const removed = withStatusAction(once, spain, { type: 'remove' })
    expect(withStatusAction(removed, spain, { type: 'remove' })).toEqual([])
  })
})
