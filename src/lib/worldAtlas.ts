import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson'
import motionUrl from '../data/world-motion.topo.json?url'
import detailUrl from '../data/world-detail.topo.json?url'

/**
 * The world's country shapes, from the compact TopoJSON built by
 * `scripts/build-world-atlas.mjs`.
 *
 * - `motion`: coarse (~100 KB), for anything that redraws every frame.
 * - `detail`: finer (~330 KB), for the map at rest and when zoomed in.
 *
 * Both carry the same features with the same `name` / `ISO3166-1-Alpha-3`
 * properties, so `featureIdentity` reads them like the old GeoJSON. The files
 * are emitted as hashed assets, fetched on first use, and cached per session.
 */
export type WorldDetail = 'motion' | 'detail'

export type WorldFeatures = FeatureCollection<Geometry, GeoJsonProperties>

type WorldTopology = Topology<{ countries: GeometryCollection<GeoJsonProperties> }>

const URLS: Record<WorldDetail, string> = { motion: motionUrl, detail: detailUrl }

function isWorldTopology(value: unknown): value is WorldTopology {
  if (typeof value !== 'object' || value === null) return false
  const topo = value as { type?: unknown; objects?: { countries?: { type?: unknown } } }
  return topo.type === 'Topology' && topo.objects?.countries?.type === 'GeometryCollection'
}

/** Decodes a world topology into a GeoJSON FeatureCollection of countries. */
export function decodeWorld(value: unknown): WorldFeatures {
  if (!isWorldTopology(value)) {
    throw new Error('World atlas is not a TopoJSON topology with a countries collection')
  }
  return feature(value, value.objects.countries)
}

const cache = new Map<WorldDetail, Promise<WorldFeatures>>()

/** Loads (once) and decodes the world at the given level of detail. */
export function loadWorld(detail: WorldDetail): Promise<WorldFeatures> {
  let pending = cache.get(detail)
  if (!pending) {
    pending = fetch(URLS[detail])
      .then(res => {
        if (!res.ok) throw new Error(`World atlas request failed: ${res.status}`)
        return res.json() as Promise<unknown>
      })
      .then(decodeWorld)
    // A failed load should be retryable, not cached forever.
    pending.catch(() => cache.delete(detail))
    cache.set(detail, pending)
  }
  return pending
}
