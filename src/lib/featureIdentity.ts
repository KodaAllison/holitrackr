import type { Feature, GeoJsonProperties, Geometry } from 'geojson'
import type { CountryIdentity } from './visitedCountries'

/**
 * Country identity read from a GeoJSON feature.
 *
 * The map data comes from datasets that disagree on property names: the name
 * lives in `name` or `ADMIN`, the ISO 3166-1 alpha-3 code in
 * `ISO3166-1-Alpha-3` or `ISO_A3`. Every read of a feature's identity goes
 * through here so the fallback chain and its guards exist in one place.
 */

type CountryFeature = Feature<Geometry, GeoJsonProperties>

function firstString(
  props: GeoJsonProperties | undefined,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = props?.[key]
    if (typeof value === 'string' && value !== '') return value
  }
  return undefined
}

/** The feature's display name, or `undefined` if it has none. */
export function featureName(feature: CountryFeature | undefined): string | undefined {
  return firstString(feature?.properties, ['name', 'ADMIN'])
}

/**
 * The feature's `{ code, name }`, or `null` when either is missing — such a
 * feature cannot be matched against, or saved as, a visited country.
 */
export function featureIdentity(feature: CountryFeature | undefined): CountryIdentity | null {
  const name = featureName(feature)
  const code = firstString(feature?.properties, ['ISO3166-1-Alpha-3', 'ISO_A3'])
  return name && code ? { code, name } : null
}
