import type { IndexedCountry } from './mapEngine/countryIndex'
import type { DemoStatus, TourStop } from './mapEngine/drawSignIn'

/**
 * The sign-in screen's demo journey. It is illustrative only: never a real
 * user's data. The globe tours these west to east, lighting each one up.
 */
export const DEMO_TOUR: { name: string; status: DemoStatus }[] = [
  { name: 'Mexico', status: 'visited' },
  { name: 'Peru', status: 'bucketlist' },
  { name: 'Iceland', status: 'bucketlist' },
  { name: 'Portugal', status: 'visited' },
  { name: 'Morocco', status: 'visited' },
  { name: 'France', status: 'visited' },
  { name: 'Italy', status: 'visited' },
  { name: 'Norway', status: 'bucketlist' },
  { name: 'Greece', status: 'visited' },
  { name: 'Egypt', status: 'visited' },
  { name: 'Kenya', status: 'bucketlist' },
  { name: 'India', status: 'visited' },
  { name: 'Thailand', status: 'visited' },
  { name: 'Vietnam', status: 'visited' },
  { name: 'Japan', status: 'visited' },
  { name: 'Australia', status: 'visited' },
  { name: 'New Zealand', status: 'bucketlist' },
]

/** Seconds spent on each stop: linger, then travel to the next. */
export const STEP_SECONDS = 1.6

export function buildTour(countries: IndexedCountry[]): TourStop[] {
  const byName = new Map(countries.map(c => [c.identity.name, c]))
  return DEMO_TOUR
    .flatMap(({ name, status }) => {
      const country = byName.get(name)
      return country ? [{ country, status }] : []
    })
    .sort((a, b) => a.country.anchor[0] - b.country.anchor[0])
}

export interface TourMoment {
  /** The stop being shown. */
  index: number
  /** Progress through that stop, 0-1. */
  phase: number
  rotate: [number, number]
  /** How lit each stop is, 0-1, by stop index. */
  fill: (stop: number) => number
  /** Visited stops lit so far (the "n / 195" counter). */
  count: number
  calloutAlpha: number
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (x: number) => x * x * (3 - 2 * x)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** The globe faces slightly west of the stop, tilted towards it, so the callout has room. */
function rotationFacing(lon: number, lat: number): [number, number] {
  return [-(lon - 22), -Math.max(-35, Math.min(45, lat * 0.6))]
}

/**
 * Where the tour is after `seconds`. With reduced motion it is a still frame:
 * everything lit, resting on Italy (or the first stop).
 */
export function tourAt(stops: TourStop[], seconds: number, reduced: boolean): TourMoment {
  const n = stops.length
  const visitedTotal = stops.filter(s => s.status === 'visited').length
  if (n === 0) return { index: 0, phase: 0, rotate: [0, 0], fill: () => 0, count: 0, calloutAlpha: 0 }

  if (reduced) {
    const italy = stops.findIndex(s => s.country.identity.name === 'Italy')
    const index = italy === -1 ? 0 : italy
    const [lon, lat] = stops[index].country.anchor
    return { index, phase: 0.3, rotate: rotationFacing(lon, lat), fill: () => 1, count: visitedTotal, calloutAlpha: 1 }
  }

  const k = (Math.max(0, seconds) % (n * STEP_SECONDS)) / STEP_SECONDS
  // Float rounding can land k exactly on n (e.g. 27.2 % 27.200000000000003), so keep the index in range.
  const index = Math.min(n - 1, Math.floor(k))
  const phase = Math.min(1, k - index)
  const next = (index + 1) % n
  const [alon, alat] = stops[index].country.anchor
  const [blon, blat] = stops[next].country.anchor
  // Linger on the stop, then travel to the next, arriving as it lights up.
  // The last leg wraps eastwards round to the first stop.
  const travel = smooth(clamp01((phase - 0.55) / 0.45))
  const lon = lerp(alon, blon + (next === 0 ? 360 : 0), travel)
  const lat = lerp(alat, blat, travel)
  // On the way round from the last stop, everything fades out to start again.
  const fadeOut = index === n - 1 ? 1 - travel : 1
  const fill = (stop: number) =>
    (stop < index ? 1 : stop === index ? clamp01(phase / 0.25) : 0) * fadeOut
  let count = 0
  for (let j = 0; j <= index; j++) {
    if (stops[j].status === 'visited' && (j < index || phase > 0.12)) count++
  }
  const calloutAlpha = clamp01((phase - 0.08) / 0.12) * clamp01((0.62 - phase) / 0.1)
  return { index, phase, rotate: rotationFacing(lon, lat), fill, count, calloutAlpha }
}
