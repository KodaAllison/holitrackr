import type { Continent } from '../lib/continents'

export interface PublicCountry {
  alpha3: string
  alpha2: string
  name: string
  continent: Continent
}

export interface PublicStatsResponse {
  countries: PublicCountry[]
  countryCount: number
  continentCount: number
  continents: Continent[]
  generatedAt: string
}

export interface PublicStatsError {
  error: string
}
