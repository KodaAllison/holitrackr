import { describe, expect, it } from 'vitest'
import type { VisitedCountry } from '../types'
import { atlasProgress } from './atlasProgress'

const v = (code: string, name: string, status: VisitedCountry['status'] = 'visited'): VisitedCountry => ({ code, name, status })

describe('atlasProgress', () => {
  it('is empty for a new atlas', () => {
    expect(atlasProgress([])).toEqual({ countries: 0, continents: 0, share: 0 })
  })

  it('counts visited countries and distinct continents, not the bucket list', () => {
    const progress = atlasProgress([
      v('ESP', 'Spain'),
      v('ITA', 'Italy'),
      v('JPN', 'Japan'),
      v('PER', 'Peru', 'bucketlist'),
    ])
    expect(progress.countries).toBe(3)
    expect(progress.continents).toBe(2)
    expect(progress.share).toBeCloseTo(3 / 195)
  })

  it('places Natural Earth -99 rows by name', () => {
    expect(atlasProgress([v('-99', 'France'), v('-99', 'Norway')]).continents).toBe(1)
  })

  it('ignores rows with no known continent', () => {
    expect(atlasProgress([v('ZZZ', 'Atlantis')])).toMatchObject({ countries: 1, continents: 0 })
  })
})
