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

export type CreateCountryParseResult =
  | { success: true; value: CreateCountryInput }
  | { success: false; error: 'Invalid payload' | 'Invalid status' }
