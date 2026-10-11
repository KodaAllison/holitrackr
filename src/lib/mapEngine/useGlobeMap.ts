import { useCallback, useEffect, useRef } from 'react'
import { geoOrthographic, type GeoStream } from 'd3-geo'
import type { IndexedCountry } from './countryIndex'
import { centerOf, decay, dragRotate, fitGlobe, turnTo, type LonLat, type Rotation } from './globeMotion'
import { pickTarget } from './hitTest'
import type { MapViewOptions } from './mapView'
import { drawPulse } from './pulse'
import { ShapeCache } from './renderer'
import { pointFrom, useCanvasSize } from './useCanvasSize'
import { useMapInteraction } from './useMapInteraction'
import { DEFAULT_GLOBE, globeRadius, type GlobeView } from './views'

export interface GlobeMapOptions extends MapViewOptions {
  /** Coarse countries, drawn while the globe moves. Falls back to `countries`. */
  motionCountries: IndexedCountry[] | null
  /** Where to start (e.g. the view saved before switching to the flat map). */
  initialView?: GlobeView
  /** Receives the current rotation and zoom, for the globe → flat morph. */
  viewRef?: React.MutableRefObject<GlobeView | null>
}

const MIN_ZOOM = 1
const MAX_ZOOM = 6
/** Idle spin speed (deg/ms) and how long input must be quiet before it starts. */
const SPIN = 0.006
const IDLE_MS = 4000
/** A press that moves further than this (px) is a drag, not a click. */
const CLICK_SLOP = 4
const IDENTITY = { k: 1, x: 0, y: 0 }

interface Turn {
  at: (t: number) => Rotation
  start: number
  duration: number
}

/**
 * The spinnable globe (orthographic) on a canvas: drag to spin with inertia,
 * wheel or `zoomBy` to zoom, click to turn a country to the front, and a slow
 * idle spin that pauses on hover, drag or selection. The animation loop only
 * runs while something moves; reduced motion turns off inertia, idle spin
 * and animated turns. Hit-testing, hover, focus and "World view" come from
 * the shared `useMapInteraction` core.
 */
export function useGlobeMap(options: GlobeMapOptions) {
  const { containerRef, canvasRef, size } = useCanvasSize()
  const rotation = useRef<Rotation>((options.initialView ?? DEFAULT_GLOBE).rotate)
  const zoom = useRef((options.initialView ?? DEFAULT_GLOBE).zoom)
  const velocity = useRef<[number, number]>([0, 0])
  const turn = useRef<Turn | null>(null)
  const press = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null)
  const hovering = useRef(false)
  const lastInput = useRef(0)
  const frame = useRef(0)
  const lastFrame = useRef(0)
  const idleTimer = useRef(0)
  const pulse = useRef<{ country: IndexedCountry; start: number } | null>(null)

  const radius = globeRadius(size)

  const projectionFor = useCallback((rotate: Rotation, clip = true) => {
    const p = geoOrthographic()
      .translate([size.width / 2, size.height / 2])
      .scale(radius * zoom.current)
      .rotate(rotate)
      .precision(0.5)
    return clip ? p.clipAngle(90) : p.preclip((stream: GeoStream) => stream)
  }, [radius, size])

  // The callbacks run later (events and effects), so they may use the motion helpers declared below.
  const { latest, reduced, drawFrame, hitTest, hoverAt } = useMapInteraction(options, {
    locate: (x, y) => {
      const r = radius * zoom.current
      if ((x - size.width / 2) ** 2 + (y - size.height / 2) ** 2 > r * r) return null
      const lonLat = projectionFor(rotation.current).invert?.([x, y])
      return lonLat && Number.isFinite(lonLat[0]) ? lonLat : null
    },
    // "World view": zoom back out, leaving the rotation where it is.
    onWorldView: () => {
      zoom.current = MIN_ZOOM
      kick()
    },
    // External focus (e.g. picked in search): turn the globe to it.
    onFocus: (match, target) => {
      turnToCountry(match)
      // Reduced motion: the turn is instant and there's no pulse (the toast still shows).
      // A newer focus without a pulse drops one still waiting for the last.
      pulse.current = target.pulse && !reduced.current
        ? { country: match, start: performance.now() + (turn.current?.duration ?? 0) }
        : null
      kick()
    },
  })

  // Frames always run the latest `tick`: a pending frame scheduled before a
  // resize (or before the data arrived) must not draw with stale size/props.
  const tickRef = useRef<(now: number) => void>(() => {})
  const kick = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(t => tickRef.current(t))
  }, [])
  const kickRef = useRef(kick)

  const turnToPoint = useCallback((point: LonLat) => {
    velocity.current = [0, 0]
    const { at, duration } = turnTo(rotation.current, point)
    if (reduced.current) {
      rotation.current = at(1)
    } else {
      turn.current = { at, start: performance.now(), duration }
    }
    kick()
  }, [kick, reduced])
  const turnToCountry = useCallback((c: IndexedCountry) => turnToPoint(c.anchor), [turnToPoint])

  const spinning = useCallback(() => !reduced.current && !hovering.current && !press.current
    && !latest.current.selectedKey && !document.hidden
    && performance.now() - lastInput.current > IDLE_MS, [latest, reduced])

  const tick = useCallback((now: number) => {
    frame.current = 0
    const dt = Math.min(64, lastFrame.current ? now - lastFrame.current : 16)
    lastFrame.current = now
    const [vx, vy] = velocity.current
    let moving = false

    if (turn.current) {
      const t = (now - turn.current.start) / turn.current.duration
      rotation.current = turn.current.at(t)
      if (t >= 1) turn.current = null
      moving = true
    } else if (!press.current && (Math.abs(vx) > 0.002 || Math.abs(vy) > 0.002)) {
      rotation.current = dragRotate(rotation.current, vx * dt, vy * dt, 180 / Math.PI)
      velocity.current = [decay(vx, dt), decay(vy, dt)]
      moving = true
    } else if (spinning()) {
      rotation.current = [rotation.current[0] + SPIN * dt, rotation.current[1]]
      moving = true
    }
    moving ||= press.current?.moved === true
    const opts = latest.current
    if (opts.viewRef) opts.viewRef.current = { rotate: rotation.current, zoom: zoom.current }

    const countries = (moving && opts.motionCountries) || opts.countries || opts.motionCountries
    if (countries) {
      const projection = projectionFor(rotation.current)
      const shapes = new ShapeCache(projection, centerOf(rotation.current), projectionFor(rotation.current, false))
      // The detailed anchor, so the label doesn't jump when the frame at rest swaps shapes.
      const ctx = drawFrame(canvasRef.current, {
        size, shapes, transform: IDENTITY, countries, rim: true, anchorCountries: opts.countries ?? countries,
      })
      const p = pulse.current
      if (ctx && p) {
        const pulsing = drawPulse(ctx, projection(p.country.anchor), now - p.start)
        if (!pulsing) pulse.current = null
        moving ||= pulsing
      }
    }

    if (moving) {
      frame.current = requestAnimationFrame(t => tickRef.current(t))
    } else {
      // One more frame at rest swaps in the detailed countries.
      lastFrame.current = 0
      window.clearTimeout(idleTimer.current)
      if (!reduced.current) {
        const wait = Math.max(0, IDLE_MS - (performance.now() - lastInput.current)) + 50
        idleTimer.current = window.setTimeout(() => kickRef.current(), wait)
      }
    }
  }, [canvasRef, drawFrame, latest, projectionFor, reduced, size, spinning])

  useEffect(() => { tickRef.current = tick; kickRef.current = kick })

  // Idle spin waits IDLE_MS from mount, not from page load.
  useEffect(() => { lastInput.current = performance.now() }, [])

  const { countries, motionCountries, statusOf, hoveredKey, selectedKey } = options
  useEffect(kick, [countries, motionCountries, statusOf, hoveredKey, selectedKey, size, kick])

  useEffect(() => () => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
    window.clearTimeout(idleTimer.current)
  }, [])

  const zoomBy = useCallback((factor: number) => {
    zoom.current = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.current * factor))
    lastInput.current = performance.now()
    latest.current.onMoveStart()
    kick()
  }, [kick, latest])

  /** Turn and zoom to frame the marked countries (zoomed out if none). */
  const fitMine = useCallback(() => {
    const { countries, statusOf } = latest.current
    const fit = fitGlobe((countries ?? []).filter(c => statusOf(c)).map(c => c.anchor))
    zoom.current = fit?.zoom ?? MIN_ZOOM
    lastInput.current = performance.now()
    latest.current.onMoveStart()
    if (fit) turnToPoint(fit.center)
    else kick()
  }, [kick, latest, turnToPoint])

  // Wheel needs a non-passive native listener to stop the page scrolling.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomBy(Math.exp(-e.deltaY * 0.0015))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [canvasRef, zoomBy])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const [x, y] = pointFrom(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    press.current = { x, y, t: performance.now(), moved: false }
    velocity.current = [0, 0]
    turn.current = null
    lastInput.current = performance.now()
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const [x, y] = pointFrom(event)
    const p = press.current
    if (p) {
      const dx = x - p.x
      const dy = y - p.y
      if (!p.moved && Math.hypot(dx, dy) < CLICK_SLOP) return
      if (!p.moved) {
        latest.current.onMoveStart()
        latest.current.onHover(null, 0, 0)
      }
      const now = performance.now()
      const dt = Math.max(1, now - p.t)
      const r = radius * zoom.current
      rotation.current = dragRotate(rotation.current, dx, dy, r)
      // Degrees per ms, in the same units dragRotate uses with radius 180/π.
      const k = 180 / Math.PI / r
      velocity.current = [(dx * k) / dt, (dy * k) / dt]
      press.current = { x, y, t: now, moved: true }
      lastInput.current = now
      event.currentTarget.style.cursor = 'grabbing'
      kick()
      return
    }
    if (event.pointerType === 'touch') return
    hovering.current = true
    hoverAt(x, y, event.currentTarget)
  }, [hoverAt, kick, latest, radius])

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const p = press.current
    press.current = null
    event.currentTarget.style.cursor = 'grab'
    lastInput.current = performance.now()
    if (reduced.current || !p?.moved || performance.now() - p.t > 80) velocity.current = [0, 0]
    if (p?.moved) {
      kick()
      return
    }
    const [x, y] = pointFrom(event)
    const pick = pickTarget(hitTest(x, y))
    if (!pick) return
    if ('cluster' in pick) {
      const centre = projectionFor(rotation.current).invert?.([pick.cluster.x, pick.cluster.y])
      turnToPoint(centre ?? pick.cluster.members[0].anchor)
      zoomBy(3)
      return
    }
    // The country turns to the front, at the centre.
    latest.current.onPick(pick.country, size.width / 2, size.height / 2)
    turnToCountry(pick.country)
  }, [hitTest, kick, latest, projectionFor, reduced, size, turnToCountry, turnToPoint, zoomBy])

  const onPointerLeave = useCallback(() => {
    hovering.current = false
    latest.current.onHover(null, 0, 0)
    kick()
  }, [kick, latest])

  return {
    containerRef,
    canvasRef,
    zoomBy,
    fitMine,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onPointerCancel: onPointerUp },
  }
}
