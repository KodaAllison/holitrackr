import { describe, expect, it } from 'vitest'
import type { VisitedCountry } from '../types'
import { buildTimeline, monthIndex, nearestTrip, tripAtOrBefore } from './timelineModel'

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
