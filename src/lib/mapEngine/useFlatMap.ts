import { useCallback, useEffect, useMemo, useRef } from 'react'
import { geoPath } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import { mainland, type IndexedCountry } from './countryIndex'
import { ease } from './globeMotion'
import { pickTarget } from './hitTest'
import type { MapViewOptions } from './mapView'
import { drawPulse } from './pulse'
import { ShapeCache, type ViewTransform } from './renderer'
import { pointFrom, useCanvasSize } from './useCanvasSize'
import { useMapInteraction } from './useMapInteraction'
import {
  clampView, coverView, FLAT_MAX_ZOOM, flatLimits, flatProjection, frameCountry, frameMarked, NO_INSET, rescaleView, spanWidth,
  type FlatLimits, type MapInset,
} from './views'

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
  /** How much of the inset's bottom is opaque UI the world may rise under (default: all of it). */
  coveredBottom?: number
}

const MAX_ZOOM = FLAT_MAX_ZOOM
const FIT_MAX_ZOOM = 6
const FIT_MS = 750
/** Focus frames a country at most this zoomed in, and at least this many degrees of longitude across. */
const FOCUS_MAX_ZOOM = 6
const FOCUS_MIN_SPAN = 30

const toZoom = ({ k, x, y }: ViewTransform): ZoomTransform => zoomIdentity.translate(x, y).scale(k)

/**
 * The flat (Equal Earth) map on a canvas: d3-zoom pan/zoom and on-demand
 * redraws (nothing runs while idle, so a hidden tab costs nothing).
 * Hit-testing, hover, focus and "World view" come from the shared
 * `useMapInteraction` core.
 */
export function useFlatMap(options: FlatMapOptions) {
  const { containerRef, canvasRef, size } = useCanvasSize()

  const transform = useRef<ViewTransform>(zoomIdentity)
  const frame = useRef(0)
  const zoomBehavior = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)
  const fitAnim = useRef(0)
  /** A pan/zoom asked for before d3-zoom was set up, applied when it is. */
  const pendingView = useRef<ZoomTransform | null>(null)
  const pulse = useRef<{ country: IndexedCountry; start: number } | null>(null)
  /** The opening fit has run, or a focus took its place. */
  const fitted = useRef(false)

  const { top, right, bottom, left } = options.inset ?? NO_INSET
  const coveredBottom = options.coveredBottom ?? bottom
  const inset = useMemo(() => ({ top, right, bottom, left }), [top, right, bottom, left])
  const projection = useMemo(() => flatProjection(size, inset), [size, inset])
  const shapes = useMemo(() => new ShapeCache(projection), [projection])
  const limits = useMemo(() => flatLimits(size, inset, MAX_ZOOM, coveredBottom), [size, inset, coveredBottom])
  const worldWidth = limits.bounds[1][0] - limits.bounds[0][0]
  /** The limits the current pan/zoom was last set up under, to carry it across a resize. */
  const appliedLimits = useRef<FlatLimits | null>(null)
  const minFitSpan = options.minFitSpan

  // The callbacks run later (events and effects), so they may use the motion helpers declared below.
  const { latest, reduced, drawFrame, hitTest, hoverAt } = useMapInteraction(options, {
    locate: (x, y) => {
      const t = transform.current
      return projection.invert?.([(x - t.x) / t.k, (y - t.y) / t.k]) ?? null
    },
    // "World view": back out to the whole map.
    onWorldView: () => { animateTo(coverView(limits)) },
    // External focus (search, the list, a milestone): pan/zoom to the country.
    onFocus: (country, target) => {
      fitted.current = true
      const fit = frameCountry(
        geoPath(projection).bounds(mainland(country)), size, inset, FOCUS_MAX_ZOOM, spanWidth(worldWidth, FOCUS_MIN_SPAN), limits,
      )
      const landsIn = animateTo(fit)
      // Reduced motion: the move is instant and there's no pulse (the toast still shows).
      // A newer focus without a pulse drops one still waiting for the last.
      pulse.current = target.pulse && !reduced.current ? { country, start: performance.now() + landsIn } : null
      requestDraw()
    },
    focusReady: size.width > 0,
    // One set before this view opened (e.g. on the globe) counts only while its country is still open.
    reapplyFocus: 'selected',
  })

  // Frames always run the latest `draw`, so one scheduled before a resize uses the new size.
  const drawRef = useRef<(now: number) => void>(() => {})
  const requestDraw = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(now => drawRef.current(now))
  }, [])

  const draw = useCallback((now: number) => {
    frame.current = 0
    const { countries } = latest.current
    const t = transform.current
    const ctx = countries && drawFrame(canvasRef.current, { size, shapes, transform: t, countries })
    const p = pulse.current
    if (!ctx || !p) return
    const at = shapes.anchor(p.country)
    // The milestone pulse keeps frames coming until it has finished.
    if (drawPulse(ctx, at && [at[0] * t.k + t.x, at[1] * t.k + t.y], now - p.start)) requestDraw()
    else pulse.current = null
  }, [canvasRef, drawFrame, latest, requestDraw, shapes, size])
  useEffect(() => { drawRef.current = draw })

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
      .scaleExtent([limits.minK, limits.maxK])
      .extent([[0, 0], [size.width, size.height]])
      // The world's own bounds, by the same clamp the fits use (see `FlatLimits`).
      .constrain(transform => {
        const { k, x, y } = clampView(transform, limits)
        return zoomIdentity.translate(x, y).scale(k)
      })
      // Only the user's own pans and zooms, not programmatic fits (they have no sourceEvent).
      .on('start', event => {
        if (!event.sourceEvent) return
        // The user takes over: stop any fit/focus move, and play a waiting pulse now.
        cancelAnimationFrame(fitAnim.current)
        const p = pulse.current
        if (p && p.start > performance.now()) p.start = performance.now()
        latest.current.onMoveStart()
      })
      .on('zoom', event => {
        transform.current = event.transform
        if (latest.current.viewRef) latest.current.viewRef.current = event.transform
        requestDraw()
      })
    const selection = select(canvas)
    // A move under way was aimed with the old limits: drop it like a user gesture does,
    // and play a pulse waiting on it now.
    cancelAnimationFrame(fitAnim.current)
    const waiting = pulse.current
    if (waiting && waiting.start > performance.now()) waiting.start = performance.now()
    // d3's `transform` does not apply the extents, so the start view is clamped here:
    // one asked for earlier, else the current view carried across the resize, else the cover view.
    const prev = appliedLimits.current
    const start = pendingView.current ?? (prev ? rescaleView(transform.current, prev, limits) : coverView(limits))
    selection.call(behavior).call(behavior.transform, toZoom(clampView(start, limits)))
    pendingView.current = null
    appliedLimits.current = limits
    zoomBehavior.current = behavior
    return () => { selection.on('.zoom', null) }
  }, [canvasRef, latest, size, limits, requestDraw])

  /**
   * Animate the pan/zoom to `target` (instantly with reduced motion, or
   * before the map is set up); returns how long until it lands, in ms.
   */
  const animateTo = useCallback((target: ViewTransform): number => {
    const canvas = canvasRef.current
    const behavior = zoomBehavior.current
    if (!canvas || !behavior) {
      pendingView.current = toZoom(target)
      return 0
    }
    const selection = select(canvas)
    const from = transform.current
    cancelAnimationFrame(fitAnim.current)
    if (reduced.current) {
      selection.call(behavior.transform, toZoom(clampView(target, limits)))
      return 0
    }
    const start = performance.now()
    const step = (now: number) => {
      const u = ease(Math.min(1, (now - start) / FIT_MS))
      const k = from.k * Math.pow(target.k / from.k, u)
      // Each step is clamped too: a straight-line move between two valid views can clip a corner.
      selection.call(behavior.transform, toZoom(clampView(
        { k, x: from.x + (target.x - from.x) * u, y: from.y + (target.y - from.y) * u }, limits,
      )))
      if (u < 1) fitAnim.current = requestAnimationFrame(step)
    }
    fitAnim.current = requestAnimationFrame(step)
    return FIT_MS
  }, [canvasRef, reduced, limits])

  /** Pan/zoom to frame the marked countries (the whole world if none). */
  const fitMine = useCallback(() => {
    const { countries, statusOf } = latest.current
    if (!countries || size.width === 0) return
    const boxes = countries.filter(c => statusOf(c)).map(c => shapes.bounds(c))
    const fit = frameMarked(boxes, size, inset, FIT_MAX_ZOOM, spanWidth(worldWidth, minFitSpan ?? 0), limits)
    animateTo(fit)
  }, [animateTo, latest, shapes, size, inset, worldWidth, minFitSpan, limits])

  /** The +/- buttons: zoom about the centre, within the zoom limits. */
  const zoomBy = useCallback((factor: number) => {
    const canvas = canvasRef.current
    const behavior = zoomBehavior.current
    if (canvas && behavior) select(canvas).call(behavior.scaleBy, factor)
  }, [canvasRef])

  // Fit once, when the view opens with data and a size (unless a focus got there first).
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
