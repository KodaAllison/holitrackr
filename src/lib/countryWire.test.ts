import { describe, expect, it } from 'vitest'
import { serializeStoredCountry } from '../server/countryPayloads'
import { serializeVisitRow } from '../server/countryVisits'
import {
  isCountryIdentity,
  isRating,
  isTags,
  parseCountryDto,
  parseCountryIdentity,
  parseRating,
  parseTagList,
  parseVisitDto,
} from './countryWire'

describe('ratings', () => {
  it.each([1, 2, 3, 4, 5])('accepts %s', (rating) => {
    expect(isRating(rating)).toBe(true)
    expect(parseRating(rating)).toBe(rating)
  })

  it.each([0, 6, -1, 4.6, 0.5, 5.0001, NaN, Infinity, '4', null, undefined, true, [4]])(
    'rejects %s',
    (rating) => {
      expect(isRating(rating)).toBe(false)
      expect(parseRating(rating)).toBeNull()
    },
  )
})

describe('tags', () => {
  it('accepts arrays of strings, including empty', () => {
    expect(isTags([])).toBe(true)
    expect(isTags(['Food', 'Beach'])).toBe(true)
  })

  it.each([['Food'], [[1]], [['a', 2]], [null], [{}]])('rejects %j', (tags) => {
    expect(isTags(tags)).toBe(false)
  })

  it('parseTagList keeps strings and rejects non-arrays', () => {
    expect(parseTagList(['a', 3, 'b'])).toEqual(['a', 'b'])
    expect(parseTagList('a')).toBeNull()
    expect(parseTagList(undefined)).toBeNull()
  })
})

describe('country identity', () => {
  it('accepts code and name strings', () => {
    expect(isCountryIdentity({ code: '-99', name: 'France', extra: 1 })).toBe(true)
    expect(parseCountryIdentity({ code: '-99', name: 'France', extra: 1 })).toEqual({ code: '-99', name: 'France' })
  })

  it.each([[{ code: 'ESP' }], [{ name: 'Spain' }], [{ code: 1, name: 'Spain' }], [[]], [null], ['ESP']])(
    'rejects %j',
    (value) => {
      expect(isCountryIdentity(value)).toBe(false)
      expect(parseCountryIdentity(value)).toBeUndefined()
    },
  )
})

describe('parseVisitDto', () => {
  const visit = { id: 2, visitedAt: '2019-03', place: 'Seville', rating: 5, notes: 'n', tags: ['Food'] }

  it('accepts a full visit and one with only the required fields', () => {
    expect(parseVisitDto(visit)).toEqual(visit)
    expect(parseVisitDto({ id: 1, visitedAt: '2020-12' })).toMatchObject({ id: 1, visitedAt: '2020-12' })
  })

  it.each([
    [{ ...visit, id: 1.5 }],
    [{ ...visit, id: '1' }],
    [{ ...visit, visitedAt: '2019-13' }],
    [{ ...visit, visitedAt: '2019-03-01' }],
    [{ ...visit, visitedAt: undefined }],
    [{ ...visit, rating: 0 }],
    [{ ...visit, rating: 4.5 }],
    [{ ...visit, tags: [1] }],
    [{ ...visit, place: 3 }],
    [null],
  ])('rejects %j', (value) => {
    expect(parseVisitDto(value)).toBeUndefined()
  })
})

describe('parseCountryDto', () => {
  const country = { code: 'ESP', name: 'Spain', status: 'visited', visitedAt: '2015-07', rating: 1, tags: [] }

  it('accepts boundary ratings and a bare country', () => {
    expect(parseCountryDto(country)).toMatchObject({ rating: 1 })
    expect(parseCountryDto({ ...country, rating: 5 })).toMatchObject({ rating: 5 })
    expect(parseCountryDto({ code: 'ESP', name: 'Spain', status: 'bucketlist' })).toMatchObject({ status: 'bucketlist' })
  })

  it.each([
    [{ ...country, rating: 0 }],
    [{ ...country, rating: 6 }],
    [{ ...country, rating: 2.5 }],
    [{ ...country, tags: ['a', 1] }],
    [{ ...country, visitedAt: '2015-7' }],
    [{ ...country, visitedAt: '2015-00' }],
    [{ ...country, status: 'lived' }],
    [{ ...country, code: undefined }],
    [{ ...country, visits: {} }],
    [{ ...country, visits: [{ id: 1, visitedAt: '2019-03', rating: 9 }] }],
    [[]],
  ])('rejects %j', (value) => {
    expect(parseCountryDto(value)).toBeUndefined()
  })
})

describe('server output round-trips through the client parser', () => {
  const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value))
  const tagCases = [null, '', '[]', 'not json', '[1,"a"]']
  const ratingCases = [null, 7, 0]

  it.each(tagCases)('country with stored tags %j', (tags) => {
    for (const rating of ratingCases) {
      for (const status of ['visited', 'bucketlist', 'lived']) {
        const row = {
          country_code: 'ESP', country_name: 'Spain', status, notes: null, place: null,
          visit_date: '2015-07-01', rating, tags,
        }
        expect(parseCountryDto(wire(serializeStoredCountry(row)))).toBeDefined()
      }
    }
  })

  it.each(tagCases)('visit with stored tags %j', (tags) => {
    for (const rating of ratingCases) {
      const row = {
        id: 3, country_code: 'ESP', country_name: 'Spain', visit_date: '2015-07-01',
        place: null, rating, notes: null, tags,
      }
      expect(parseVisitDto(wire(serializeVisitRow(row)))).toBeDefined()
    }
  })

  it('country with no stored date', () => {
    const row = {
      country_code: 'ESP', country_name: 'Spain', status: 'visited', notes: null, place: null,
      visit_date: null, rating: null, tags: null,
    }
    expect(parseCountryDto(wire(serializeStoredCountry(row)))).toBeDefined()
  })
})
