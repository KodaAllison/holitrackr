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

export interface PublicCountryRow {
  country_code: unknown
  country_name: unknown
}

export interface PublicStatsDatabase {
  query: (
    statement: string,
    parameters: unknown[],
  ) => Promise<{ rows: PublicCountryRow[] }>
}

export interface PublicStatsRequest {
  method: string
  origin: string | undefined
  ownerUserId: string | undefined
  database: PublicStatsDatabase
  now?: () => Date
}

export interface PublicStatsHttpResponse {
  status: number
  headers: Record<string, string>
  body?: PublicStatsResponse | PublicStatsError
}
