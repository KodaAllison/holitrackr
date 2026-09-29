import { useCallback, useEffect, useMemo, useRef } from 'react'
import { geoEqualEarth } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import type { VisitedCountry } from '../../types'
import { clusterAt, type Cluster } from './clusters'
import { countryAt, type IndexedCountry } from './countryIndex'
import { CLUSTER_RADIUS, createHatch, drawMap, ShapeCache, type ViewTransform } from './renderer'
import { pointFrom, useCanvasSize } from './useCanvasSize'

type Status = VisitedCountry['status']

export interface MapViewOptions {
  countries: IndexedCountry[] | null
  statusOf: (country: IndexedCountry) => Status | undefined
  hoveredKey: string | null
  selectedKey: string | null
  onHover: (country: IndexedCountry | null, x: number, y: number) => void
  onPick: (country: IndexedCountry, x: number, y: number) => void
  onMoveStart: () => void
}

const MAX_ZOOM = 12
const PAD = 4

/**
 * The flat (Equal Earth) map on a canvas: sizing and devicePixelRatio,
 * d3-zoom pan/zoom, on-demand redraws (nothing runs while idle, so a hidden
 * tab costs nothing) and hit-testing.
 */
export function useFlatMap(options: MapViewOptions) {
  const { containerRef, canvasRef, size } = useCanvasSize()

  const latest = useRef(options)
  const transform = useRef<ViewTransform>(zoomIdentity)
  const clusters = useRef<Cluster<IndexedCountry>[]>([])
  const frame = useRef(0)
  const hatch = useRef<CanvasPattern | null>(null)
  const zoomBehavior = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)

  const projection = useMemo(() => geoEqualEarth().fitExtent(
    [[PAD, PAD], [Math.max(PAD + 1, size.width - PAD), Math.max(PAD + 1, size.height - PAD)]],
    { type: 'Sphere' }
  ), [size])
  const shapes = useMemo(() => new ShapeCache(projection), [projection])

  const draw = useCallback(() => {
    frame.current = 0
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const opts = latest.current
    const { countries } = opts
    if (!canvas || !ctx || !countries || size.width === 0) return
    hatch.current ??= createHatch(ctx)
    clusters.current = drawMap({
      ctx, ...size, dpr: window.devicePixelRatio || 1,
      shapes, transform: transform.current,
      countries, statusOf: opts.statusOf,
      hoveredKey: opts.hoveredKey, selectedKey: opts.selectedKey, hatch: hatch.current,
    })
  }, [canvasRef, shapes, size])

  const requestDraw = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(draw)
  }, [draw])

  // Latest props for the imperative draw/hit-test paths.
  useEffect(() => { latest.current = options })

  // Redraw only when something drawn changes, not on every pointer move.
  const { countries, statusOf, hoveredKey, selectedKey } = options
  useEffect(requestDraw, [countries, statusOf, hoveredKey, selectedKey, requestDraw])

  useEffect(() => () => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width === 0) return
    const behavior = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .extent([[0, 0], [size.width, size.height]])
      .translateExtent([[0, 0], [size.width, size.height]])
      .on('start', () => latest.current.onMoveStart())
      .on('zoom', event => { transform.current = event.transform; requestDraw() })
    const selection = select(canvas)
    selection.call(behavior).call(behavior.transform, zoomIdentity)
    zoomBehavior.current = behavior
    return () => { selection.on('.zoom', null) }
  }, [canvasRef, size, requestDraw])

  const hitTest = useCallback((x: number, y: number) => {
    const cluster = clusterAt(clusters.current, x, y, CLUSTER_RADIUS)
    if (cluster) return cluster
    const { countries } = latest.current
    const t = transform.current
    const lonLat = projection.invert?.([(x - t.x) / t.k, (y - t.y) / t.k])
    return countries && lonLat ? countryAt(countries, lonLat) : null
  }, [projection])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'touch' || event.buttons) return
    const [x, y] = pointFrom(event)
    const hit = hitTest(x, y)
    const country = hit && 'members' in hit ? (hit.members.length === 1 ? hit.members[0] : null) : hit
    event.currentTarget.style.cursor = hit ? 'pointer' : 'grab'
    latest.current.onHover(country, x, y)
  }, [hitTest])

  const onPointerLeave = useCallback(() => latest.current.onHover(null, 0, 0), [])

  const onClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const [x, y] = pointFrom(event)
    const hit = hitTest(x, y)
    if (!hit) return
    if (!('members' in hit)) return latest.current.onPick(hit, x, y)
    if (hit.members.length === 1) return latest.current.onPick(hit.members[0], x, y)
    // A cluster: zoom in around it until its members separate.
    const canvas = canvasRef.current
    const behavior = zoomBehavior.current
    if (canvas && behavior) select(canvas).call(behavior.scaleBy, 3, [hit.x, hit.y])
  }, [canvasRef, hitTest])

  return { containerRef, canvasRef, handlers: { onPointerMove, onPointerLeave, onClick } }
}
