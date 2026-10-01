import type { VisitedCountry } from '../types'
import { getContinent } from './continents'
import { isKnownContinent } from './countryMetadata'

/** "195" is the 193 UN member states plus the 2 observer states. */
export const TOTAL_COUNTRIES = 195
export const TOTAL_CONTINENTS = 7

export interface AtlasProgress {
  /** Visited countries (bucket-list rows don't count). */
  countries: number
  /** Distinct continents with at least one visited country. */
  continents: number
  /** Visited share of the 195, from 0 to 1. */
  share: number
}

/** The map's summary: how much of the world the user has visited. */
export function atlasProgress(visitedCountries: VisitedCountry[]): AtlasProgress {
  const visited = visitedCountries.filter(v => v.status === 'visited')
  const continents = new Set(
    visited.map(v => getContinent(v.code, v.name)).filter(isKnownContinent)
  )
  return {
    countries: visited.length,
    continents: continents.size,
    share: Math.min(1, visited.length / TOTAL_COUNTRIES),
  }
}
