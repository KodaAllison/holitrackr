import { useCallback, useEffect, useMemo, useRef } from 'react'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { mainland, type IndexedCountry } from './countryIndex'
import { flatShapes, flatSizes } from './flatShapes'
import { ease, wrapLon } from './globeMotion'
import { pickTarget } from './hitTest'
import type { MapViewOptions } from './mapView'
import { drawPulse } from './pulse'
import type { ShapeCache, ViewTransform } from './renderer'
import { eventRow, pointFrom, useCanvasSize } from './useCanvasSize'
import { useMapInteraction } from './useMapInteraction'
import {
  clampView, coverView, FLAT_MAX_ZOOM, flatLimits, frameCountry, frameMarked, locateAt, NO_INSET, renderTransform, rescaleView,
  spanWidth, worldWidth, type FlatLimits, type FlatView, type MapInset,
} from './views'
import { panLongitude } from './wrapPan'

export interface FlatMapOptions extends MapViewOptions {
  /** Once the data is in, animate to fit the user's marked countries. */
  fitOnOpen?: boolean
  /** Hold the open fit until this is true (e.g. the user's countries have loaded). */
  fitReady?: boolean
  /** Fit to at least this many degrees of longitude, so one small country doesn't fill the view. */
  minFitSpan?: number
  /** Receives the current view, for the flat → globe morph. */
  viewRef?: React.MutableRefObject<FlatView | null>
  /** Keep the world (and "Fit to my countries") clear of floating UI, e.g. the mobile sheet. */
  inset?: MapInset
  /** How much of the inset's bottom is opaque UI the world may rise under (default: all of it). */
  coveredBottom?: number
  /** The central meridian the map opens on (desktop: the globe's, so the unroll lands on the first view). */
  initialLon?: number
}

const MAX_ZOOM = FLAT_MAX_ZOOM
const FIT_MAX_ZOOM = 6
const FIT_MS = 750
/** Focus frames a country at most this zoomed in, and at least this many degrees of longitude across. */
const FOCUS_MAX_ZOOM = 6
const FOCUS_MIN_SPAN = 30

/**
 * The flat (Equal Earth) map on a canvas: d3-zoom pan/zoom and on-demand
 * redraws (nothing runs while idle, so a hidden tab costs nothing). It wraps
 * east-west: d3's sideways pans turn the world (`wrapPan`), so there is no
 * east or west edge. Hit-testing, hover, focus and "World view" come from
 * the shared `useMapInteraction` core.
 */
export function useFlatMap(options: FlatMapOptions) {
  const { containerRef, canvasRef, size } = useCanvasSize()

  /** What is drawn: d3's zoom and vertical pan, and the central meridian its sideways pans have turned to. */
  const view = useRef<FlatView>({ k: 1, y: 0, lon: wrapLon(options.initialLon ?? 0) })
  /** d3-zoom's own transform as last seen: only its changes count (its `x` runs free). */
  const affine = useRef<ViewTransform>({ k: 1, x: 0, y: 0 })
  /** A view being set by the map itself, whose meridian is given rather than worked out from d3's change. */
  const setting = useRef<FlatView | null>(null)
  const frame = useRef(0)
  const zoomBehavior = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)
  const fitAnim = useRef(0)
  /** A view asked for before d3-zoom was set up, applied when it is. */
  const pendingView = useRef<FlatView | null>(null)
  const pulse = useRef<{ country: IndexedCountry; start: number } | null>(null)
  /** The opening fit has run, or a focus took its place. */
  const fitted = useRef(false)

  const { top, right, bottom, left } = options.inset ?? NO_INSET
  const coveredBottom = options.coveredBottom ?? bottom
  const inset = useMemo(() => ({ top, right, bottom, left }), [top, right, bottom, left])
  const limits = useMemo(() => flatLimits(size, inset, MAX_ZOOM, coveredBottom), [size, inset, coveredBottom])
  const sizeOf = useMemo(() => flatSizes(limits), [limits])
  /** The limits the current view was last set up under, to carry it across a resize. */
  const appliedLimits = useRef<FlatLimits | null>(null)
  const minFitSpan = options.minFitSpan

  /** The shapes for one central meridian, kept while the map only zooms or pans up and down. */
  const shapeCache = useRef<{ limits: FlatLimits; lon: number; shapes: ShapeCache } | null>(null)
  const shapesAt = useCallback((lon: number) => {
    const cached = shapeCache.current
    if (cached && cached.limits === limits && cached.lon === lon) return cached.shapes
    const shapes = flatShapes(limits, lon, sizeOf)
    shapeCache.current = { limits, lon, shapes }
    return shapes
  }, [limits, sizeOf])

  // The callbacks run later (events and effects), so they may use the motion helpers declared below.
  const { latest, reduced, drawFrame, hitTest, hoverAt } = useMapInteraction(options, {
    locate: (x, y) => locateAt(view.current, limits, x, y),
    // "World view": back out to the whole map, about the meridian in the middle now.
    onWorldView: () => { animateTo(coverView(limits, view.current.lon)) },
    // External focus (search, the list, a milestone): turn and zoom to the country, the short way round.
    onFocus: (country, target) => {
      fitted.current = true
      const minWidth = spanWidth(worldWidth(limits), FOCUS_MIN_SPAN)
      const landsIn = animateTo(frameCountry(mainland(country), limits, inset, FOCUS_MAX_ZOOM, minWidth, view.current.lon))
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
    const shapes = shapesAt(view.current.lon)
    const t = renderTransform(view.current, limits)
    const ctx = countries && drawFrame(canvasRef.current, { size, shapes, transform: t, countries })
    const p = pulse.current
    if (!ctx || !p) return
    const at = shapes.anchor(p.country)
    // The milestone pulse keeps frames coming until it has finished.
    if (drawPulse(ctx, at && [at[0] * t.k + t.x, at[1] * t.k + t.y], now - p.start)) requestDraw()
    else pulse.current = null
  }, [canvasRef, drawFrame, latest, limits, requestDraw, shapesAt, size])
  useEffect(() => { drawRef.current = draw })

  // Redraw only when something drawn changes, not on every pointer move.
  const { countries, statusOf, hoveredKey, selectedKey } = options
  useEffect(requestDraw, [countries, statusOf, hoveredKey, selectedKey, requestDraw])

  useEffect(() => () => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
  }, [])

  /** Show `v` (already clamped) through d3-zoom, so its gestures carry on from there. */
  const setView = useCallback((v: FlatView) => {
    const canvas = canvasRef.current
    const behavior = zoomBehavior.current
    if (!canvas || !behavior) return
    setting.current = v
    try {
      select(canvas).call(behavior.transform, zoomIdentity.translate(renderTransform(v, limits).x, v.y).scale(v.k))
    } finally {
      setting.current = null
    }
  }, [canvasRef, limits])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width === 0) return
    const behavior = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([limits.minK, limits.maxK])
      .extent([[0, 0], [size.width, size.height]])
      // Zoom and the vertical pan by the same clamp the fits use (see `FlatLimits`); sideways is a turn, with no edge.
      .constrain(t => {
        const { k, y } = clampView({ k: t.k, y: t.y }, limits)
        return zoomIdentity.translate(t.x, y).scale(k)
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
        const next: ViewTransform = event.transform
        const lon = setting.current?.lon
          ?? panLongitude(view.current.lon, affine.current, next, eventRow(event.sourceEvent, canvas), limits)
        affine.current = { k: next.k, x: next.x, y: next.y }
        view.current = { k: next.k, y: next.y, lon }
        if (latest.current.viewRef) latest.current.viewRef.current = view.current
        requestDraw()
      })
    // A move under way was aimed with the old limits: drop it like a user gesture does,
    // and play a pulse waiting on it now.
    cancelAnimationFrame(fitAnim.current)
    const waiting = pulse.current
    if (waiting && waiting.start > performance.now()) waiting.start = performance.now()
    // d3's `transform` does not apply the clamp, so the start view is clamped here:
    // one asked for earlier, else the current view carried across the resize, else the World view.
    const prev = appliedLimits.current
    const start = pendingView.current ?? (prev ? rescaleView(view.current, prev, limits) : coverView(limits, view.current.lon))
    const selection = select(canvas).call(behavior)
    zoomBehavior.current = behavior
    setView(clampView(start, limits))
    pendingView.current = null
    appliedLimits.current = limits
    return () => { selection.on('.zoom', null) }
  }, [canvasRef, latest, size, limits, requestDraw, setView])

  /**
   * Animate to `target` (instantly with reduced motion, or before the map is
   * set up), turning the short way round the antimeridian; returns how long
   * until it lands, in ms.
   */
  const animateTo = useCallback((target: FlatView): number => {
    if (!canvasRef.current || !zoomBehavior.current) {
      pendingView.current = target
      return 0
    }
    const from = view.current
    cancelAnimationFrame(fitAnim.current)
    if (reduced.current) {
      setView(clampView(target, limits))
      return 0
    }
    const turn = wrapLon(target.lon - from.lon)
    const start = performance.now()
    const step = (now: number) => {
      const u = ease(Math.min(1, (now - start) / FIT_MS))
      const k = from.k * Math.pow(target.k / from.k, u)
      // Each step is clamped too: a straight-line move between two valid views can leave the allowed region.
      setView(clampView({ k, y: from.y + (target.y - from.y) * u, lon: wrapLon(from.lon + turn * u) }, limits))
      if (u < 1) fitAnim.current = requestAnimationFrame(step)
    }
    fitAnim.current = requestAnimationFrame(step)
    return FIT_MS
  }, [canvasRef, reduced, limits, setView])

  /** Turn and zoom to frame the marked countries (the World view if none). */
  const fitMine = useCallback(() => {
    const { countries, statusOf } = latest.current
    if (!countries || size.width === 0) return
    const marked = countries.filter(c => statusOf(c)).map(c => c.feature)
    const minWidth = spanWidth(worldWidth(limits), minFitSpan ?? 0)
    animateTo(frameMarked(marked, limits, inset, FIT_MAX_ZOOM, minWidth, view.current.lon))
  }, [animateTo, latest, size, inset, minFitSpan, limits])

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
    // A cluster: zoom in around it until its members separate (d3 zooms about it; `wrapPan` keeps it in place).
    const canvas = canvasRef.current
    const behavior = zoomBehavior.current
    if (canvas && behavior) select(canvas).call(behavior.scaleBy, 3, [pick.cluster.x, pick.cluster.y])
  }, [canvasRef, hitTest, latest])

  return { containerRef, canvasRef, fitMine, zoomBy, handlers: { onPointerMove, onPointerLeave, onClick } }
}
