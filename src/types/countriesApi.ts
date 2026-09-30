import type { CountryVisit, VisitedCountry } from './country'

export interface StoredCountryRow {
  country_code: string
  country_name: string
  status: string
  notes: string | null
  place: string | null
  visit_date: string | null
  rating: number | null
  tags: string | null
}

export interface CountryIdentity {
  code: string
  name: string
}

export type AddCountryInput = Pick<
  VisitedCountry,
  'code' | 'name' | 'status' | 'notes'
>

export interface CreateCountryInput extends CountryIdentity {
  status: VisitedCountry['status']
  notes: string | null
}

export interface UpdateCountryInput extends CountryIdentity {
  notes: string | null
  place: string | null
  visitDate: string | null
  rating: number | null
  tags: string | null
}

/** JSON representation returned by the countries API. */
export type VisitedCountryDto = VisitedCountry

export type CreateCountryParseResult =
  | { success: true; value: CreateCountryInput }
  | { success: false; error: 'Invalid payload' | 'Invalid status' }

/** A `country_visits` row as the API selects it (`visit_date` via ::text, `YYYY-MM-DD`). */
export interface CountryVisitRow {
  id: number
  country_code: string
  country_name: string
  visit_date: string
  place: string | null
  rating: number | null
  notes: string | null
  tags: string | null
}

/** JSON representation of one extra visit. */
export type CountryVisitDto = CountryVisit

/** Validated body of POST /api/countries/visits. */
export interface CreateVisitInput extends CountryIdentity {
  /** `YYYY-MM-01` */
  visitDate: string
  place: string | null
  rating: number | null
  notes: string | null
  /** JSON array text, as stored. */
  tags: string | null
}

/** Validated body of PATCH /api/countries/visits. */
export interface UpdateVisitInput {
  id: number
  visitDate: string
  place: string | null
  rating: number | null
  notes: string | null
  tags: string | null
}
