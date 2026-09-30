import { useCallback, useEffect, useMemo, useRef } from 'react'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import type { VisitedCountry } from '../../types'
import { clusterAt, type Cluster } from './clusters'
import { countryAt, type IndexedCountry } from './countryIndex'
import { ease } from './globeMotion'
import { CLUSTER_RADIUS, createHatch, drawMap, screenAnchor, ShapeCache, type ViewTransform } from './renderer'
import { pointFrom, useCanvasSize } from './useCanvasSize'
import { flatFit, flatProjection, NO_INSET, type MapInset } from './views'

type Status = VisitedCountry['status']

export interface MapViewOptions {
  countries: IndexedCountry[] | null
  statusOf: (country: IndexedCountry) => Status | undefined
  hoveredKey: string | null
  selectedKey: string | null
  onHover: (country: IndexedCountry | null, x: number, y: number) => void
  onPick: (country: IndexedCountry, x: number, y: number) => void
  onMoveStart: () => void
  /** Zoom back out to the whole world whenever this changes ("World view"). */
  worldViewSeq?: number
  /**
   * Called after every frame with the selected country's anchor in screen
   * px, or null when nothing is selected or it can't be seen (for the name
   * label, which follows the map without a React render per frame).
   */
  onSelectedAnchor?: (point: [number, number] | null) => void
}

export interface FlatMapOptions extends MapViewOptions {
  /** Once the data is in, animate to fit the user's marked countries. */
  fitOnOpen?: boolean
  /** Receives the current pan/zoom, for the flat → globe morph. */
  viewRef?: React.MutableRefObject<ViewTransform | null>
  /** Keep the world (and "Fit to my countries") clear of floating UI, e.g. the mobile sheet. */
  inset?: MapInset
}

const MAX_ZOOM = 12
const FIT_MAX_ZOOM = 6
const FIT_MS = 750

/**
 * The flat (Equal Earth) map on a canvas: sizing and devicePixelRatio,
 * d3-zoom pan/zoom, on-demand redraws (nothing runs while idle, so a hidden
 * tab costs nothing) and hit-testing.
 */
export function useFlatMap(options: FlatMapOptions) {
  const { containerRef, canvasRef, size } = useCanvasSize()

  const latest = useRef(options)
  const transform = useRef<ViewTransform>(zoomIdentity)
  const clusters = useRef<Cluster<IndexedCountry>[]>([])
  const frame = useRef(0)
  const hatch = useRef<CanvasPattern | null>(null)
  const zoomBehavior = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)

  const { top, right, bottom, left } = options.inset ?? NO_INSET
  const inset = useMemo(() => ({ top, right, bottom, left }), [top, right, bottom, left])
  const projection = useMemo(() => flatProjection(size, inset), [size, inset])
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
    opts.onSelectedAnchor?.(screenAnchor(shapes, transform.current, countries, opts.selectedKey))
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
      // The inset lets the view pan the world into the clear area, not past it.
      .translateExtent([[-inset.left, -inset.top], [size.width + inset.right, size.height + inset.bottom]])
      // Only the user's own pans and zooms, not programmatic fits.
      .on('start', event => { if (event.sourceEvent) latest.current.onMoveStart() })
      .on('zoom', event => {
        transform.current = event.transform
        if (latest.current.viewRef) latest.current.viewRef.current = event.transform
        requestDraw()
      })
    const selection = select(canvas)
    selection.call(behavior).call(behavior.transform, zoomIdentity)
    zoomBehavior.current = behavior
    return () => { selection.on('.zoom', null) }
  }, [canvasRef, size, inset, requestDraw])

  const fitAnim = useRef(0)

  /** Animate the pan/zoom to `target` (instantly with reduced motion). */
  const animateTo = useCallback((target: typeof zoomIdentity) => {
    const canvas = canvasRef.current
    const behavior = zoomBehavior.current
    if (!canvas || !behavior) return
    const selection = select(canvas)
    const from = transform.current
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      selection.call(behavior.transform, target)
      return
    }
    cancelAnimationFrame(fitAnim.current)
    const start = performance.now()
    const step = (now: number) => {
      const u = ease(Math.min(1, (now - start) / FIT_MS))
      const k = from.k * Math.pow(target.k / from.k, u)
      selection.call(behavior.transform, zoomIdentity
        .translate(from.x + (target.x - from.x) * u, from.y + (target.y - from.y) * u).scale(k))
      if (u < 1) fitAnim.current = requestAnimationFrame(step)
    }
    fitAnim.current = requestAnimationFrame(step)
  }, [canvasRef])

  /** Pan/zoom to frame the marked countries (the whole world if none). */
  const fitMine = useCallback(() => {
    const { countries, statusOf } = latest.current
    if (!countries || size.width === 0) return
    const marked = countries.filter(c => statusOf(c))
    let target = zoomIdentity
    if (marked.length > 0) {
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
      for (const c of marked) {
        const [[a, b], [cx, cy]] = shapes.bounds(c)
        x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy)
      }
      const fit = flatFit([[x0, y0], [x1, y1]], size, inset, FIT_MAX_ZOOM)
      target = zoomIdentity.translate(fit.x, fit.y).scale(fit.k)
    }
    animateTo(target)
  }, [animateTo, shapes, size, inset])

  /** The +/- buttons: zoom about the centre, within the zoom limits. */
  const zoomBy = useCallback((factor: number) => {
    const canvas = canvasRef.current
    const behavior = zoomBehavior.current
    if (canvas && behavior) select(canvas).call(behavior.scaleBy, factor)
  }, [canvasRef])

  // "World view": back out to the whole map.
  // Only a change after mount counts, not the value a remount starts with.
  const worldViewSeq = options.worldViewSeq
  const seenWorldView = useRef(worldViewSeq)
  useEffect(() => {
    if (worldViewSeq === seenWorldView.current) return
    seenWorldView.current = worldViewSeq
    animateTo(zoomIdentity)
  }, [worldViewSeq, animateTo])

  // Fit once, when the view opens with data and a size.
  const fitted = useRef(false)
  const ready = options.countries !== null && size.width > 0
  useEffect(() => {
    if (!ready || fitted.current || !latest.current.fitOnOpen) return
    fitted.current = true
    fitMine()
  }, [ready, fitMine])

  useEffect(() => () => cancelAnimationFrame(fitAnim.current), [])

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

  return { containerRef, canvasRef, fitMine, zoomBy, handlers: { onPointerMove, onPointerLeave, onClick } }
}
