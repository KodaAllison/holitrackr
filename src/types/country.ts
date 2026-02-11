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
}
