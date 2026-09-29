import { geoArea, geoBounds, geoCentroid, geoContains, geoDistance } from 'd3-geo'
import type { Feature, GeoJsonProperties, Geometry, Polygon } from 'geojson'
import type { CountryIdentity } from '../visitedCountries'
import type { WorldFeatures } from '../worldAtlas'
import { featureIdentity } from '../featureIdentity'

/**
 * The map engine's view of one country: its feature plus everything the
 * renderer and hit-testing need, computed once per dataset.
 */
export interface IndexedCountry {
  identity: CountryIdentity
  feature: Feature<Geometry, GeoJsonProperties>
  /** [[west, south], [east, north]]; west > east when it crosses 180°. */
  bounds: [[number, number], [number, number]]
  /** Label/dot point: centroid of the largest polygon, [lon, lat]. */
  anchor: [number, number]
  /** Spherical area in steradians. */
  area: number
  /** Angular distance (radians) from the anchor to the country's furthest vertex. */
  reach: number
}

/**
 * Countries at or below this area (~4,000 km²: Luxembourg, Cape Verde and
 * smaller) can shrink below a clickable size, so the renderer may draw them
 * as dots instead of shapes.
 */
export const MICRO_AREA = 1e-4

function maxDistance(geometry: Geometry, from: [number, number]): number {
  let max = 0
  const visit = (ring: number[][]) => {
    for (const p of ring) max = Math.max(max, geoDistance(from, [p[0], p[1]]))
  }
  if (geometry.type === 'Polygon') geometry.coordinates.forEach(visit)
  else if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach(poly => poly.forEach(visit))
  return max
}

function largestPolygon(geometry: Geometry): Polygon | null {
  if (geometry.type === 'Polygon') return geometry
  if (geometry.type !== 'MultiPolygon') return null
  let best: Polygon | null = null
  let bestArea = -1
  for (const coordinates of geometry.coordinates) {
    const polygon: Polygon = { type: 'Polygon', coordinates }
    const area = geoArea(polygon)
    if (area > bestArea) {
      best = polygon
      bestArea = area
    }
  }
  return best
}

export function buildCountryIndex(world: WorldFeatures): IndexedCountry[] {
  const index: IndexedCountry[] = []
  for (const feature of world.features) {
    const identity = featureIdentity(feature)
    if (!identity || !feature.geometry) continue
    const main = largestPolygon(feature.geometry)
    const anchor = geoCentroid(main ?? feature)
    index.push({
      identity,
      feature,
      bounds: geoBounds(feature),
      anchor,
      area: geoArea(feature),
      reach: maxDistance(feature.geometry, anchor),
    })
  }
  return index
}

function inBounds(bounds: IndexedCountry['bounds'], [lon, lat]: [number, number]): boolean {
  const [[west, south], [east, north]] = bounds
  if (lat < south || lat > north) return false
  return west <= east ? lon >= west && lon <= east : lon >= west || lon <= east
}

/** The country containing the point, or null for sea and unmapped land. */
export function countryAt(index: IndexedCountry[], point: [number, number]): IndexedCountry | null {
  for (const country of index) {
    if (inBounds(country.bounds, point) && geoContains(country.feature, point)) return country
  }
  return null
}
