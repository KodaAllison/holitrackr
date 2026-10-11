import { countryKey, type CountryIdentity } from '../visitedCountries'
import { clusterAt, type Cluster } from './clusters'
import { CLUSTER_RADIUS } from './renderer'

/** What sits under a point: a micro-state dot or cluster, a country, or nothing. */
export type Hit<T> = Cluster<T> | T | null

function isCluster<T extends object>(hit: Cluster<T> | T): hit is Cluster<T> {
  return 'members' in hit
}

/**
 * The thing under screen point (x, y): a dot or cluster drawn in the last
 * frame wins (they sit on top), else whatever `locate` finds there.
 */
export function hitAt<T extends object>(
  clusters: Cluster<T>[],
  x: number,
  y: number,
  locate: (x: number, y: number) => T | null,
): Hit<T> {
  return clusterAt(clusters, x, y, CLUSTER_RADIUS) ?? locate(x, y)
}

/** The country a hover names: a single dot is its country; a cluster of several names none. */
export function hoverTarget<T extends object>(hit: Hit<T>): T | null {
  if (!hit || !isCluster(hit)) return hit
  return hit.members.length === 1 ? hit.members[0] : null
}

/** What a click does: open a country, or zoom into a cluster of several. */
export type PickTarget<T> = { country: T } | { cluster: Cluster<T> }

export function pickTarget<T extends object>(hit: Hit<T>): PickTarget<T> | null {
  if (!hit) return null
  if (!isCluster(hit)) return { country: hit }
  return hit.members.length === 1 ? { country: hit.members[0] } : { cluster: hit }
}

/** The indexed country for an identity (by country key), or null. */
export function findIndexed<T extends { identity: CountryIdentity }>(list: T[] | null, identity: CountryIdentity): T | null {
  const key = countryKey(identity)
  return list?.find(c => countryKey(c.identity) === key) ?? null
}
