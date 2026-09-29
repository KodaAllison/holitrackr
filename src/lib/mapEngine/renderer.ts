import { geoPath, type GeoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo'
import type { VisitedCountry } from '../../types'
import { countryKey } from '../visitedCountries'
import { clusterDots, type Cluster, type Dot } from './clusters'
import { MICRO_AREA, type IndexedCountry } from './countryIndex'
import { MAP_COLORS } from './palette'

type Status = VisitedCountry['status']

/** Pan/zoom applied on top of the base projection, in CSS pixels. */
export interface ViewTransform {
  k: number
  x: number
  y: number
}

export interface RenderInput {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  dpr: number
  shapes: ShapeCache
  transform: ViewTransform
  countries: IndexedCountry[]
  statusOf: (country: IndexedCountry) => Status | undefined
  hoveredKey: string | null
  selectedKey: string | null
  hatch: CanvasPattern | null
}

/**
 * Projected shapes as Path2D, built once per projection (i.e. per resize).
 * Pan and zoom are a canvas transform on top, so frames never re-project
 * geometry; they only rasterise cached paths.
 */
export class ShapeCache {
  readonly sphere: Path2D
  private readonly path: GeoPath<void, GeoPermissibleObjects>
  private readonly shapes = new Map<IndexedCountry, Path2D>()
  private readonly sizes = new Map<IndexedCountry, number>()
  private readonly points = new Map<IndexedCountry, [number, number] | null>()
  private readonly groups = new WeakMap<IndexedCountry[], Path2D>()

  constructor(readonly projection: GeoProjection) {
    this.path = geoPath(projection)
    this.sphere = new Path2D(this.path({ type: 'Sphere' }) ?? '')
  }

  shape(c: IndexedCountry): Path2D {
    let shape = this.shapes.get(c)
    if (!shape) {
      shape = new Path2D(this.path(c.feature) ?? '')
      this.shapes.set(c, shape)
    }
    return shape
  }

  /** All countries in one path, for the land fill and border stroke. */
  all(countries: IndexedCountry[]): Path2D {
    let group = this.groups.get(countries)
    if (!group) {
      group = new Path2D()
      for (const c of countries) group.addPath(this.shape(c))
      this.groups.set(countries, group)
    }
    return group
  }

  /** Largest projected dimension at zoom 1, in CSS px. */
  size(c: IndexedCountry): number {
    let size = this.sizes.get(c)
    if (size === undefined) {
      const [[x0, y0], [x1, y1]] = this.path.bounds(c.feature)
      size = Math.max(x1 - x0, y1 - y0)
      this.sizes.set(c, size)
    }
    return size
  }

  /** The anchor projected at zoom 1, or null if it can't be projected. */
  anchor(c: IndexedCountry): [number, number] | null {
    if (!this.points.has(c)) this.points.set(c, this.projection(c.anchor))
    return this.points.get(c) ?? null
  }
}

/** Below this on-screen size (px) a micro-state is drawn as a dot. */
const DOT_THRESHOLD = 8
/** Dots closer than this (px) merge into a cluster. */
export const CLUSTER_RADIUS = 12

function fillGroup(input: RenderInput, countries: IndexedCountry[], style: string | CanvasPattern) {
  const { ctx, shapes } = input
  ctx.fillStyle = style
  for (const c of countries) ctx.fill(shapes.shape(c))
}

function outline(input: RenderInput, key: string | null, color: string, width: number) {
  const country = key && input.countries.find(c => countryKey(c.identity) === key)
  if (!country) return
  const { ctx, shapes, transform } = input
  ctx.strokeStyle = color
  ctx.lineWidth = width / transform.k
  ctx.stroke(shapes.shape(country))
}

function microDots(input: RenderInput): Dot<IndexedCountry>[] {
  const { shapes, transform } = input
  const dots: Dot<IndexedCountry>[] = []
  for (const c of input.countries) {
    if (c.area > MICRO_AREA) continue
    if (shapes.size(c) * transform.k >= DOT_THRESHOLD) continue
    const p = shapes.anchor(c)
    if (!p) continue
    dots.push({ item: c, x: p[0] * transform.k + transform.x, y: p[1] * transform.k + transform.y })
  }
  return dots
}

function drawClusters(input: RenderInput, clusters: Cluster<IndexedCountry>[]) {
  const { ctx } = input
  for (const cluster of clusters) {
    const single = cluster.members.length === 1
    const status = single ? input.statusOf(cluster.members[0]) : undefined
    const key = single ? countryKey(cluster.members[0].identity) : null
    const selected = key !== null && key === input.selectedKey
    const active = selected || (key !== null && key === input.hoveredKey)
    // Unmarked dots stay quiet so dozens of islands don't clutter the map;
    // marked ones, clusters holding a marked country, and the active one stand out.
    const marked = cluster.members.some(c => input.statusOf(c))
    ctx.beginPath()
    ctx.arc(cluster.x, cluster.y, single ? (marked || active ? 4.5 : 2.5) : (marked ? 8 : 6.5), 0, Math.PI * 2)
    ctx.fillStyle = status === 'visited' ? MAP_COLORS.visited
      : status === 'bucketlist' ? MAP_COLORS.bucket
      : single ? '#FFFFFF' : MAP_COLORS.land
    ctx.fill()
    ctx.lineWidth = active ? 2 : 1
    ctx.strokeStyle = selected ? MAP_COLORS.selected
      : marked || active ? MAP_COLORS.hover : MAP_COLORS.border
    ctx.stroke()
    if (!single) {
      ctx.fillStyle = marked ? MAP_COLORS.hover : '#6B7280'
      ctx.font = `600 ${marked ? 10 : 9}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(cluster.members.length), cluster.x, cluster.y + 0.5)
    }
  }
}

/**
 * Draws one frame of the flat map and returns the micro-state clusters in
 * screen space, for hit-testing until the next frame.
 */
export function drawMap(input: RenderInput): Cluster<IndexedCountry>[] {
  const { ctx, width, height, dpr, transform: t, shapes } = input

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  ctx.setTransform(dpr * t.k, 0, 0, dpr * t.k, dpr * t.x, dpr * t.y)
  ctx.fillStyle = MAP_COLORS.ocean
  ctx.fill(shapes.sphere)

  const visited = input.countries.filter(c => input.statusOf(c) === 'visited')
  const bucket = input.countries.filter(c => input.statusOf(c) === 'bucketlist')
  ctx.fillStyle = MAP_COLORS.land
  ctx.fill(shapes.all(input.countries))
  fillGroup(input, visited, MAP_COLORS.visited)
  fillGroup(input, bucket, MAP_COLORS.bucket)
  if (input.hatch) {
    input.hatch.setTransform?.(new DOMMatrix().scale(1 / t.k))
    fillGroup(input, bucket, input.hatch)
  }

  ctx.strokeStyle = MAP_COLORS.border
  ctx.lineWidth = 0.6 / t.k
  ctx.stroke(shapes.all(input.countries))

  outline(input, input.hoveredKey, MAP_COLORS.hover, 1.5)
  outline(input, input.selectedKey, MAP_COLORS.selected, 2)

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const clusters = clusterDots(microDots(input), CLUSTER_RADIUS)
  drawClusters(input, clusters)
  return clusters
}

/** Diagonal amber hatch for bucket-list countries. Needs a DOM canvas. */
export function createHatch(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const tile = document.createElement('canvas')
  tile.width = tile.height = 6
  const tctx = tile.getContext('2d')
  if (!tctx) return null
  tctx.strokeStyle = MAP_COLORS.bucketHatch
  tctx.lineWidth = 1.2
  tctx.beginPath()
  tctx.moveTo(-1, 7)
  tctx.lineTo(7, -1)
  tctx.moveTo(5, 7)
  tctx.lineTo(7, 5)
  tctx.moveTo(-1, 1)
  tctx.lineTo(1, -1)
  tctx.stroke()
  return ctx.createPattern(tile, 'repeat')
}
