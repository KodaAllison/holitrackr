import type { Country, VisitedCountry } from '../types'
import { getContinent, type Continent } from './continents'
import { isKnownContinent } from './countryMetadata'
import { sameCountry } from './visitedCountries'

/** Visited-country counts worth celebrating. */
export const COUNT_MILESTONES = [10, 25, 50, 100, 150] as const

export type Milestone =
  | { id: string; kind: 'count'; count: number; country: Country }
  | { id: string; kind: 'continent'; continent: Continent; country: Country }

/**
 * The milestone reached by marking `country` visited, going from `before`
 * to `after`, or null. A count milestone wins over a new continent when
 * both happen at once.
 */
export function detectMilestone(before: VisitedCountry[], after: VisitedCountry[], country: Country): Milestone | null {
  const wasVisited = before.some(v => v.status === 'visited' && sameCountry(v, country))
  const isVisited = after.some(v => v.status === 'visited' && sameCountry(v, country))
  if (wasVisited || !isVisited) return null

  const count = after.filter(v => v.status === 'visited').length
  if ((COUNT_MILESTONES as readonly number[]).includes(count)) {
    return { id: `count-${count}`, kind: 'count', count, country }
  }

  const continent = getContinent(country.code, country.name)
  if (!isKnownContinent(continent)) return null
  const seenBefore = before.some(v => v.status === 'visited' && getContinent(v.code, v.name) === continent)
  // The very first country is not a "new continent" moment; it is just a start.
  if (seenBefore || count === 1) return null
  return { id: `continent-${continent}`, kind: 'continent', continent, country }
}

/** Human copy for the toast. */
export function milestoneMessage(m: Milestone): string {
  return m.kind === 'count'
    ? `${m.count} countries! ${m.country.name} was number ${m.count}.`
    : `First time in ${m.continent}: ${m.country.name}.`
}

const key = (userId: string) => `holitrackr:milestones:${userId}`

/** Milestones already celebrated for this user (per browser). */
export function seenMilestones(userId: string): Set<string> {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(key(userId)) ?? '[]')
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function markMilestoneSeen(userId: string, id: string): void {
  try {
    const seen = seenMilestones(userId)
    seen.add(id)
    window.localStorage.setItem(key(userId), JSON.stringify([...seen]))
  } catch {
    // Without storage a milestone may repeat after a reload; harmless.
  }
}
