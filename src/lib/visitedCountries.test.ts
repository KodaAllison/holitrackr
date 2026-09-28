import { describe, expect, it } from 'vitest'
import type { VisitedCountry } from '../types/country'
import { nextVisitedState } from './visitedCountries'

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
