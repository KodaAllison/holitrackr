import type { VisitedCountry } from './country'

export interface StoredCountryRow {
  country_code: string
  country_name: string
  status: string
  notes: string | null
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
  visitDate: string | null
  rating: number | null
  tags: string | null
}

/** JSON representation returned by the countries API. */
export type VisitedCountryDto = VisitedCountry

export type CreateCountryParseResult =
  | { success: true; value: CreateCountryInput }
  | { success: false; error: 'Invalid payload' | 'Invalid status' }
