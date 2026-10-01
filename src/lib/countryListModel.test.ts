import { describe, expect, it } from 'vitest'
import type { VisitedCountry } from '../types'
import { groupCountries, rowSubline } from './countryListModel'

const c = (code: string, name: string, extra: Partial<VisitedCountry> = {}): VisitedCountry =>
  ({ code, name, status: 'visited', ...extra })

const italy = c('ITA', 'Italy', { visitedAt: '2023-06', rating: 4, tags: ['Food', 'History'] })
const spain = c('ESP', 'Spain', { visitedAt: '2016-07' })
const france = c('-99', 'France')
const japan = c('JPN', 'Japan', { visitedAt: '2018-04' })

describe('groupCountries', () => {
  it('groups by continent, largest first, names A-Z', () => {
    const groups = groupCountries([japan, spain, italy, france], 'continent')
    expect(groups.map(g => g.heading)).toEqual(['Europe', 'Asia'])
    expect(groups[0].countries.map(x => x.name)).toEqual(['France', 'Italy', 'Spain'])
  })

  it('sorts by date newest first with undated last', () => {
    const [group] = groupCountries([spain, france, italy, japan], 'date')
    expect(group.heading).toBeNull()
    expect(group.countries.map(x => x.name)).toEqual(['Italy', 'Japan', 'Spain', 'France'])
  })

  it('sorts by name in one flat group', () => {
    const [group] = groupCountries([spain, japan, italy], 'name')
    expect(group.countries.map(x => x.name)).toEqual(['Italy', 'Japan', 'Spain'])
  })

  it('returns no groups for an empty list', () => {
    expect(groupCountries([], 'continent')).toEqual([])
  })
})

describe('rowSubline', () => {
  it('shows date, stars and tags', () => {
    expect(rowSubline(italy)).toEqual({ text: 'Jun 2023', stars: '★★★★', tags: 'Food, History' })
  })

  it('nudges for a date when undated', () => {
    expect(rowSubline(c('-99', 'France', { rating: 3 }))).toEqual({ text: 'Add a visit date' })
  })

  it('describes bucket-list rows', () => {
    expect(rowSubline(c('PER', 'Peru', { status: 'bucketlist', visitedAt: '2027-02' })).text).toBe('Hoping to go · Feb 2027')
    expect(rowSubline(c('PER', 'Peru', { status: 'bucketlist' })).text).toBe('Add when you hope to go')
  })
})
