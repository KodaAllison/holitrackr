import { useCallback, useEffect, useMemo, useRef } from 'react'
import { geoPath } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { ease } from './globeMotion'
import { pickTarget } from './hitTest'
import type { MapViewOptions } from './mapView'
import { ShapeCache, type ViewTransform } from './renderer'
import { pointFrom, useCanvasSize } from './useCanvasSize'
import { useMapInteraction } from './useMapInteraction'
import { flatProjection, frameMarked, NO_INSET, spanWidth, type MapInset } from './views'

export interface FlatMapOptions extends MapViewOptions {
  /** Once the data is in, animate to fit the user's marked countries. */
  fitOnOpen?: boolean
  /** Hold the open fit until this is true (e.g. the user's countries have loaded). */
  fitReady?: boolean
  /** Fit to at least this many degrees of longitude, so one small country doesn't fill the view. */
  minFitSpan?: number
  /** Receives the current pan/zoom, for the flat → globe morph. */
  viewRef?: React.MutableRefObject<ViewTransform | null>
  /** Keep the world (and "Fit to my countries") clear of floating UI, e.g. the mobile sheet. */
  inset?: MapInset
}

const MAX_ZOOM = 12
const FIT_MAX_ZOOM = 6
const FIT_MS = 750

/**
 * The flat (Equal Earth) map on a canvas: d3-zoom pan/zoom and on-demand
 * redraws (nothing runs while idle, so a hidden tab costs nothing).
 * Hit-testing, hover and "World view" come from the shared
 * `useMapInteraction` core.
 */
export function useFlatMap(options: FlatMapOptions) {
  const { containerRef, canvasRef, size } = useCanvasSize()

  const transform = useRef<ViewTransform>(zoomIdentity)
  const frame = useRef(0)
  const zoomBehavior = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)
  const fitAnim = useRef(0)

  const { top, right, bottom, left } = options.inset ?? NO_INSET
  const inset = useMemo(() => ({ top, right, bottom, left }), [top, right, bottom, left])
  const projection = useMemo(() => flatProjection(size, inset), [size, inset])
  const shapes = useMemo(() => new ShapeCache(projection), [projection])
  const worldWidth = useMemo(() => {
    const [[x0], [x1]] = geoPath(projection).bounds({ type: 'Sphere' })
    return x1 - x0
  }, [projection])
  const minFitSpan = options.minFitSpan

  // The callbacks run later (events and effects), so they may use the motion helpers declared below.
  const { latest, reduced, drawFrame, hitTest, hoverAt } = useMapInteraction(options, {
    locate: (x, y) => {
      const t = transform.current
      return projection.invert?.([(x - t.x) / t.k, (y - t.y) / t.k]) ?? null
    },
    // "World view": back out to the whole map.
    onWorldView: () => animateTo(zoomIdentity),
    // Focus is the globe's for now.
    onFocus: () => {},
  })

  const draw = useCallback(() => {
    frame.current = 0
    const { countries } = latest.current
    if (countries) drawFrame(canvasRef.current, { size, shapes, transform: transform.current, countries })
  }, [canvasRef, drawFrame, latest, shapes, size])

  const requestDraw = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(draw)
  }, [draw])

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
  }, [canvasRef, latest, size, inset, requestDraw])

  /** Animate the pan/zoom to `target` (instantly with reduced motion). */
  const animateTo = useCallback((target: typeof zoomIdentity) => {
    const canvas = canvasRef.current
    const behavior = zoomBehavior.current
    if (!canvas || !behavior) return
    const selection = select(canvas)
    const from = transform.current
    if (reduced.current) {
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
  }, [canvasRef, reduced])

  /** Pan/zoom to frame the marked countries (the whole world if none). */
  const fitMine = useCallback(() => {
    const { countries, statusOf } = latest.current
    if (!countries || size.width === 0) return
    const boxes = countries.filter(c => statusOf(c)).map(c => shapes.bounds(c))
    const fit = frameMarked(boxes, size, inset, FIT_MAX_ZOOM, spanWidth(worldWidth, minFitSpan ?? 0))
    animateTo(zoomIdentity.translate(fit.x, fit.y).scale(fit.k))
  }, [animateTo, latest, shapes, size, inset, worldWidth, minFitSpan])

  /** The +/- buttons: zoom about the centre, within the zoom limits. */
  const zoomBy = useCallback((factor: number) => {
    const canvas = canvasRef.current
    const behavior = zoomBehavior.current
    if (canvas && behavior) select(canvas).call(behavior.scaleBy, factor)
  }, [canvasRef])

  // Fit once, when the view opens with data and a size.
  const fitted = useRef(false)
  const ready = options.countries !== null && size.width > 0 && options.fitReady !== false
  useEffect(() => {
    if (!ready || fitted.current || !latest.current.fitOnOpen) return
    fitted.current = true
    fitMine()
  }, [ready, fitMine, latest])

  useEffect(() => () => cancelAnimationFrame(fitAnim.current), [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'touch' || event.buttons) return
    const [x, y] = pointFrom(event)
    hoverAt(x, y, event.currentTarget)
  }, [hoverAt])

  const onPointerLeave = useCallback(() => latest.current.onHover(null, 0, 0), [latest])

  const onClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const [x, y] = pointFrom(event)
    const pick = pickTarget(hitTest(x, y))
    if (!pick) return
    if ('country' in pick) return latest.current.onPick(pick.country, x, y)
    // A cluster: zoom in around it until its members separate.
    const canvas = canvasRef.current
    const behavior = zoomBehavior.current
    if (canvas && behavior) select(canvas).call(behavior.scaleBy, 3, [pick.cluster.x, pick.cluster.y])
  }, [canvasRef, hitTest, latest])

  return { containerRef, canvasRef, fitMine, zoomBy, handlers: { onPointerMove, onPointerLeave, onClick } }
}
