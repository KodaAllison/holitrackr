import { describe, expect, it } from 'vitest'
import type { VisitedCountry } from '../types'
import {
  buildTimeline, continentCount, countriesAsOf, journeySummary, monthIndex, monthLabel, nearestTrip, shortMonth,
  tripAtOrBefore, tripKey, yearStats,
} from './timelineModel'

const today = new Date(2026, 7, 15) // Aug 2026

const countries: VisitedCountry[] = [
  { code: 'JPN', name: 'Japan', status: 'visited', visitedAt: '2019-04' },
  { code: '-99', name: 'France', status: 'visited', visitedAt: '2015-07' },
  { code: 'ESP', name: 'Spain', status: 'visited', visitedAt: '2015-07' },
  { code: 'ITA', name: 'Italy', status: 'visited', visitedAt: '2016-09' },
  { code: 'CAN', name: 'Canada', status: 'visited' },
  { code: 'PER', name: 'Peru', status: 'bucketlist', visitedAt: '2027-05' },
  { code: '-99', name: 'Norway', status: 'bucketlist', visitedAt: '2027-02' },
  { code: 'ISL', name: 'Iceland', status: 'bucketlist', visitedAt: '2020-01' },
  { code: 'BRA', name: 'Brazil', status: 'bucketlist' },
]

describe('buildTimeline', () => {
  const model = buildTimeline(countries, today)

  it('orders trips oldest first, ties by name', () => {
    expect(model.trips.map(t => t.country.name)).toEqual(['France', 'Spain', 'Italy', 'Japan'])
  })

  it('groups trips by year, oldest year first', () => {
    expect(model.years.map(y => [y.year, y.trips.length])).toEqual([[2015, 2], [2016, 1], [2019, 1]])
  })

  it('marks the first trip to each continent', () => {
    expect(model.trips.map(t => t.firstIn ?? null)).toEqual(['Europe', null, null, 'Asia'])
  })

  it('keeps only future-dated bucket-list countries as planned, soonest first', () => {
    expect(model.planned.map(t => t.country.name)).toEqual(['Norway', 'Peru'])
  })

  it('collects undated visited countries', () => {
    expect(model.undated.map(c => c.name)).toEqual(['Canada'])
  })

  it('spans the ruler from the first trip year to the end of the last plan year', () => {
    expect(model.start).toBe(monthIndex(2015, 1))
    expect(model.end).toBe(monthIndex(2027, 12))
    expect(model.now).toBe(monthIndex(2026, 8))
  })

  it('handles an empty list', () => {
    const empty = buildTimeline([], today)
    expect(empty.trips).toEqual([])
    expect(empty.start).toBe(monthIndex(2026, 1))
    expect(empty.end).toBe(monthIndex(2026, 12))
  })
})

describe('buildTimeline with multiple visits', () => {
  const repeat: VisitedCountry[] = [
    {
      code: 'JPN', name: 'Japan', status: 'visited', visitedAt: '2019-04', place: 'Tokyo', rating: 4,
      visits: [
        { id: 7, visitedAt: '2024-11', place: 'Kyoto', rating: 5, tags: ['Food'] },
        { id: 3, visitedAt: '2016-02', notes: 'Stopover' },
      ],
    },
    { code: 'ESP', name: 'Spain', status: 'visited', visitedAt: '2017-06' },
    // No date on the first visit, but a dated extra visit: not "undated".
    { code: 'KEN', name: 'Kenya', status: 'visited', visits: [{ id: 9, visitedAt: '2021-08' }] },
    // Visits on a bucket-list country stay off the timeline.
    { code: 'PER', name: 'Peru', status: 'bucketlist', visitedAt: '2027-05', visits: [{ id: 11, visitedAt: '2012-01' }] },
  ]
  const model = buildTimeline(repeat, today)

  it('makes each visit its own trip, oldest first', () => {
    expect(model.trips.map(t => [t.country.name, t.journal.visitedAt, t.visit?.id ?? null])).toEqual([
      ['Japan', '2016-02', 3],
      ['Spain', '2017-06', null],
      ['Japan', '2019-04', null],
      ['Kenya', '2021-08', 9],
      ['Japan', '2024-11', 7],
    ])
  })

  it('shows each trip\'s own journal', () => {
    expect(model.trips[0].journal).toMatchObject({ notes: 'Stopover' })
    expect(model.trips[2].journal).toMatchObject({ place: 'Tokyo', rating: 4 })
    expect(model.trips[4].journal).toMatchObject({ place: 'Kyoto', rating: 5, tags: ['Food'] })
  })

  it('marks "first time in" only on the first trip to a continent', () => {
    expect(model.trips.map(t => t.firstIn ?? null)).toEqual(['Asia', 'Europe', null, 'Africa', null])
  })

  it('gives every trip a distinct key', () => {
    expect(new Set(model.trips.map(tripKey)).size).toBe(model.trips.length)
  })

  it('lists a country as undated only when none of its visits has a date', () => {
    expect(model.undated).toEqual([])
    expect(model.planned.map(t => t.country.name)).toEqual(['Peru'])
  })

  it('starts the ruler at the earliest visit', () => {
    expect(model.start).toBe(monthIndex(2016, 1))
  })
})

describe('nearestTrip / tripAtOrBefore', () => {
  const { trips } = buildTimeline(countries, today)

  it('snaps to the closest trip within tolerance', () => {
    expect(nearestTrip(trips, monthIndex(2016, 8), 2)).toBe(2)
    expect(nearestTrip(trips, monthIndex(2018, 1), 2)).toBeNull()
  })

  it('finds the latest trip not after a month', () => {
    expect(tripAtOrBefore(trips, monthIndex(2017, 1))).toBe(2)
    expect(tripAtOrBefore(trips, monthIndex(2014, 1))).toBe(-1)
  })
})

describe('feed and chip text', () => {
  const model = buildTimeline(countries, today)

  it('summarises the journey for the feed header', () => {
    expect(journeySummary(model)).toBe('4 trips since 2015 · 2 continents · 2 planned')
    expect(continentCount(model)).toBe(2)
  })

  it('leaves out what is missing', () => {
    expect(journeySummary(buildTimeline([], today))).toBe('')
    expect(journeySummary(buildTimeline([countries[0]], today))).toBe('1 trip since 2019 · 1 continent')
    expect(journeySummary(buildTimeline([countries[5]], today))).toBe('1 planned')
  })

  it('describes each year, noting new continents', () => {
    expect(model.years.map(yearStats)).toEqual([
      '2 countries · first time in Europe',
      '1 country',
      '1 country · first time in Asia',
    ])
  })

  it('counts a repeat visit once in the year and in the chip', () => {
    const repeat = buildTimeline([
      { code: 'JPN', name: 'Japan', status: 'visited', visitedAt: '2019-04', visits: [{ id: 1, visitedAt: '2019-10' }] },
      { code: 'KOR', name: 'South Korea', status: 'visited', visitedAt: '2019-06' },
    ], today)
    expect(yearStats(repeat.years[0])).toBe('2 countries · first time in Asia')
    expect(countriesAsOf(repeat.trips, 0)).toBe(1)
    expect(countriesAsOf(repeat.trips, 2)).toBe(2)
    expect(countriesAsOf(repeat.trips, -1)).toBe(0)
  })

  it('formats months', () => {
    expect(shortMonth(3)).toBe('Mar')
    expect(monthLabel(monthIndex(2024, 3))).toBe('Mar 2024')
    expect(monthLabel(monthIndex(2024, 12) + 0.4)).toBe('Dec 2024')
  })
})
