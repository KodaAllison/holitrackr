/**
 * Country as used for search, stats, and map interactions.
 * Code is ISO 3166-1 alpha-3 (e.g. "USA", "GBR").
 * Note: Some territories share codes (e.g. "-99" for France, Akrotiri) in GeoJSON data.
 */
export interface Country {
  name: string
  code: string
}

/** A visited country - stores both code and name since codes can be duplicated in GeoJSON. */
export interface VisitedCountry {
  code: string
  name: string
  status: 'visited' | 'bucketlist'
  notes?: string
  /** Where in the country, free text (e.g. "Kyoto & Osaka"). */
  place?: string
  visitedAt?: string
  rating?: number
  tags?: string[]
  /**
   * Extra visits after the first, oldest first. The fields above are the
   * country's first (primary) visit; these come from `country_visits`.
   */
  visits?: CountryVisit[]
}

/** One extra visit to a country, with its own journal. */
export interface CountryVisit {
  id: number
  /** `YYYY-MM`; every extra visit has a date. */
  visitedAt: string
  place?: string
  rating?: number
  notes?: string
  tags?: string[]
}

/** Which marked countries the map colours in (the rest draw as unmarked). */
export interface MapFilter {
  visited: boolean
  bucketlist: boolean
}
