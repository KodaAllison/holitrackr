import type { CountryVisit, VisitedCountry } from '../types'
import { getContinent, type Continent } from './continents'
import { isKnownContinent } from './countryMetadata'
import { parseVisitMonth } from './visitDate'
import { countryKey } from './visitedCountries'

/**
 * The timeline's data, derived from the visited-countries list. Time is
 * measured in whole months since year 0 (`year * 12 + month - 1`), so the
 * ruler and the feed agree on ordering without any Date maths.
 */
/** One trip's journal: the country's own fields, or an extra visit's. */
export type TripJournal = Pick<VisitedCountry, 'visitedAt' | 'place' | 'notes' | 'rating' | 'tags'>

export interface TimelineTrip {
  country: VisitedCountry
  /** The extra visit this trip is; undefined for the country's first visit. */
  visit?: CountryVisit
  journal: TripJournal
  /** Months since year 0. */
  at: number
  year: number
  /** 1-12 */
  month: number
  /** Set on the trip that first reached this continent. */
  firstIn?: Continent
}

export interface TimelineYear {
  year: number
  trips: TimelineTrip[]
}

export interface TimelineModel {
  /** Dated visits, oldest first: one per visit, so a country can appear more than once. */
  trips: TimelineTrip[]
  years: TimelineYear[]
  /** Bucket-list countries with a "Hoping to go" date, soonest first. */
  planned: TimelineTrip[]
  /** Visited countries with no dated visit at all. */
  undated: VisitedCountry[]
  /** Ruler range in months: January of the first trip's year to the end of the last year shown. */
  start: number
  end: number
  /** The current month. */
  now: number
}

export function monthIndex(year: number, month: number): number {
  return year * 12 + month - 1
}

function toTrip(country: VisitedCountry, visit?: CountryVisit): TimelineTrip | null {
  const journal: TripJournal = visit ?? country
  const parsed = parseVisitMonth(journal.visitedAt)
  return parsed ? { country, visit, journal, at: monthIndex(parsed.year, parsed.month), ...parsed } : null
}

/** A stable key for a trip: the country, plus the visit id for an extra visit. */
export function tripKey(trip: TimelineTrip): string {
  return `${trip.country.code}-${trip.country.name}-${trip.visit?.id ?? 'first'}`
}

const byTime = (a: TimelineTrip, b: TimelineTrip) =>
  a.at - b.at || a.country.name.localeCompare(b.country.name) || (a.visit?.id ?? 0) - (b.visit?.id ?? 0)

export function buildTimeline(countries: VisitedCountry[], today: Date): TimelineModel {
  const now = monthIndex(today.getFullYear(), today.getMonth() + 1)
  const trips: TimelineTrip[] = []
  const planned: TimelineTrip[] = []
  const undated: VisitedCountry[] = []

  for (const country of countries) {
    const trip = toTrip(country)
    if (country.status === 'bucketlist') {
      // Only future plans belong on the "Next" side of the ruler.
      if (trip && trip.at >= now) planned.push(trip)
    } else {
      const visits = (country.visits ?? []).map(visit => toTrip(country, visit))
      const dated = [trip, ...visits].filter((t): t is TimelineTrip => t !== null)
      if (dated.length > 0) trips.push(...dated)
      else undated.push(country)
    }
  }
  trips.sort(byTime)
  planned.sort(byTime)
  undated.sort((a, b) => a.name.localeCompare(b.name))

  const seen = new Set<Continent>()
  const years: TimelineYear[] = []
  for (const trip of trips) {
    const continent = getContinent(trip.country.code, trip.country.name)
    if (isKnownContinent(continent) && !seen.has(continent)) {
      seen.add(continent)
      trip.firstIn = continent
    }
    const last = years[years.length - 1]
    if (last?.year === trip.year) last.trips.push(trip)
    else years.push({ year: trip.year, trips: [trip] })
  }

  const firstYear = trips[0]?.year ?? planned[0]?.year ?? today.getFullYear()
  const lastAt = Math.max(now, planned[planned.length - 1]?.at ?? now)
  const lastYear = Math.floor(lastAt / 12)
  return { trips, years, planned, undated, start: monthIndex(firstYear, 1), end: monthIndex(lastYear, 12), now }
}

/**
 * The trip nearest to month `at`, if within `tolerance` months; otherwise
 * null. Used to snap the playhead to trips while dragging.
 */
export function nearestTrip(trips: TimelineTrip[], at: number, tolerance: number): number | null {
  let best: number | null = null
  let bestDistance = tolerance
  trips.forEach((trip, i) => {
    const distance = Math.abs(trip.at - at)
    if (distance <= bestDistance) {
      best = i
      bestDistance = distance
    }
  })
  return best
}

/** The index of the last trip at or before month `at`, or -1 if none. */
export function tripAtOrBefore(trips: TimelineTrip[], at: number): number {
  let index = -1
  trips.forEach((trip, i) => { if (trip.at <= at) index = i })
  return index
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * The feed header's subtitle, e.g. "16 trips since 2015 · 5 continents ·
 * 2 planned". Continents count every continent a trip has reached; the
 * planned part is left out when nothing is planned.
 */
export function journeySummary(model: TimelineModel): string {
  const parts: string[] = []
  const first = model.trips[0]
  if (first) {
    parts.push(`${plural(model.trips.length, 'trip', 'trips')} since ${first.year}`)
    parts.push(plural(continentCount(model), 'continent', 'continents'))
  }
  if (model.planned.length > 0) parts.push(`${model.planned.length} planned`)
  return parts.join(' · ')
}

/** How many continents the dated trips have reached. */
export function continentCount(model: TimelineModel): number {
  return model.trips.filter(t => t.firstIn).length
}

/** A year group's stats line, e.g. "2 countries · first time in Asia & Oceania". */
export function yearStats({ trips }: TimelineYear): string {
  const countries = new Set(trips.map(t => countryKey(t.country))).size
  const firsts = trips.flatMap(t => (t.firstIn ? [t.firstIn] : []))
  const stats = plural(countries, 'country', 'countries')
  return firsts.length > 0 ? `${stats} · first time in ${firsts.join(' & ')}` : stats
}

/** Distinct countries visited up to and including trip `active` (the map chip's count). */
export function countriesAsOf(trips: TimelineTrip[], active: number): number {
  return new Set(trips.slice(0, active + 1).map(t => countryKey(t.country))).size
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A 1-12 month as a short name, e.g. `3` → "Mar". */
export function shortMonth(month: number): string {
  return SHORT_MONTHS[month - 1] ?? ''
}

/** A month index as a label, e.g. "Mar 2024". */
export function monthLabel(at: number): string {
  const whole = Math.round(at)
  return `${shortMonth((whole % 12) + 1)} ${Math.floor(whole / 12)}`
}
