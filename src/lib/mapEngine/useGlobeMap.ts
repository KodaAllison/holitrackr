import { useCallback, useEffect, useRef } from 'react'
import { geoOrthographic, type GeoStream } from 'd3-geo'
import type { CountryIdentity } from '../visitedCountries'
import { countryKey } from '../visitedCountries'
import { clusterAt, type Cluster } from './clusters'
import { countryAt, type IndexedCountry } from './countryIndex'
import { centerOf, decay, dragRotate, turnTo, type LonLat, type Rotation } from './globeMotion'
import { CLUSTER_RADIUS, createHatch, drawMap, ShapeCache } from './renderer'
import { pointFrom, useCanvasSize } from './useCanvasSize'
import type { MapViewOptions } from './useFlatMap'
import { DEFAULT_GLOBE, globeRadius, type GlobeView } from './views'

export interface GlobeMapOptions extends MapViewOptions {
  /** Coarse countries, drawn while the globe moves. Falls back to `countries`. */
  motionCountries: IndexedCountry[] | null
  /** Turn to face this country whenever `seq` changes. */
  focus?: { country: CountryIdentity; seq: number } | null
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

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * The spinnable globe (orthographic) on a canvas: drag to spin with inertia,
 * wheel or `zoomBy` to zoom, click to turn a country to the front, and a slow
 * idle spin that pauses on hover, drag or selection. The animation loop only
 * runs while something moves; reduced motion turns off inertia, idle spin
 * and animated turns.
 */
export function useGlobeMap(options: GlobeMapOptions) {
  const { containerRef, canvasRef, size } = useCanvasSize()
  const latest = useRef(options)
  const rotation = useRef<Rotation>((options.initialView ?? DEFAULT_GLOBE).rotate)
  const zoom = useRef((options.initialView ?? DEFAULT_GLOBE).zoom)
  const velocity = useRef<[number, number]>([0, 0])
  const turn = useRef<Turn | null>(null)
  const press = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null)
  const hovering = useRef(false)
  const lastInput = useRef(0)
  const clusters = useRef<Cluster<IndexedCountry>[]>([])
  const hatch = useRef<CanvasPattern | null>(null)
  const frame = useRef(0)
  const lastFrame = useRef(0)
  const idleTimer = useRef(0)
  const reduced = useRef(prefersReducedMotion())

  const radius = globeRadius(size)

  const projectionFor = useCallback((rotate: Rotation, clip = true) => {
    const p = geoOrthographic()
      .translate([size.width / 2, size.height / 2])
      .scale(radius * zoom.current)
      .rotate(rotate)
      .precision(0.5)
    return clip ? p.clipAngle(90) : p.preclip((stream: GeoStream) => stream)
  }, [radius, size])

  const spinning = useCallback(() => !reduced.current && !hovering.current && !press.current
    && !latest.current.selectedKey && !document.hidden
    && performance.now() - lastInput.current > IDLE_MS, [])

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
    if (latest.current.viewRef) latest.current.viewRef.current = { rotate: rotation.current, zoom: zoom.current }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const opts = latest.current
    const countries = (moving && opts.motionCountries) || opts.countries || opts.motionCountries
    if (canvas && ctx && countries && size.width > 0) {
      hatch.current ??= createHatch(ctx)
      const projection = projectionFor(rotation.current)
      clusters.current = drawMap({
        ctx, ...size, dpr: window.devicePixelRatio || 1,
        shapes: new ShapeCache(projection, centerOf(rotation.current), projectionFor(rotation.current, false)),
        transform: IDENTITY,
        countries, statusOf: opts.statusOf, rim: true,
        hoveredKey: opts.hoveredKey, selectedKey: opts.selectedKey, hatch: hatch.current,
      })
    }

    if (moving) {
      frame.current = requestAnimationFrame(tick)
    } else {
      // One more frame at rest swaps in the detailed countries.
      lastFrame.current = 0
      window.clearTimeout(idleTimer.current)
      if (!reduced.current) {
        const wait = Math.max(0, IDLE_MS - (performance.now() - lastInput.current)) + 50
        idleTimer.current = window.setTimeout(() => kickRef.current(), wait)
      }
    }
  }, [canvasRef, projectionFor, size, spinning])

  const kick = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(tick)
  }, [tick])
  const kickRef = useRef(kick)

  useEffect(() => { latest.current = options; kickRef.current = kick })

  const { countries, motionCountries, statusOf, hoveredKey, selectedKey } = options
  useEffect(kick, [countries, motionCountries, statusOf, hoveredKey, selectedKey, kick])

  useEffect(() => () => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
    window.clearTimeout(idleTimer.current)
  }, [])

  const turnToPoint = useCallback((point: LonLat) => {
    velocity.current = [0, 0]
    const { at, duration } = turnTo(rotation.current, point)
    if (reduced.current) {
      rotation.current = at(1)
    } else {
      turn.current = { at, start: performance.now(), duration }
    }
    kick()
  }, [kick])
  const turnToCountry = useCallback((c: IndexedCountry) => turnToPoint(c.anchor), [turnToPoint])

  // External focus (e.g. picked in search): turn the globe to it.
  const focusSeq = options.focus?.seq
  useEffect(() => {
    const target = latest.current.focus
    const list = latest.current.countries
    if (!target || !list) return
    const key = countryKey(target.country)
    const match = list.find(c => countryKey(c.identity) === key)
    if (match) turnToCountry(match)
  }, [focusSeq, countries, turnToCountry])

  const zoomBy = useCallback((factor: number) => {
    zoom.current = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.current * factor))
    lastInput.current = performance.now()
    latest.current.onMoveStart()
    kick()
  }, [kick])

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

  const hitTest = useCallback((x: number, y: number) => {
    const cluster = clusterAt(clusters.current, x, y, CLUSTER_RADIUS)
    if (cluster) return cluster
    const list = latest.current.countries
    const r = radius * zoom.current
    if (!list || (x - size.width / 2) ** 2 + (y - size.height / 2) ** 2 > r * r) return null
    const lonLat = projectionFor(rotation.current).invert?.([x, y])
    return lonLat && Number.isFinite(lonLat[0]) ? countryAt(list, lonLat) : null
  }, [projectionFor, radius, size])

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
    const hit = hitTest(x, y)
    const country = hit && 'members' in hit ? (hit.members.length === 1 ? hit.members[0] : null) : hit
    event.currentTarget.style.cursor = hit ? 'pointer' : 'grab'
    latest.current.onHover(country, x, y)
  }, [hitTest, kick, radius])

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
    const hit = hitTest(x, y)
    if (!hit) return
    if ('members' in hit && hit.members.length > 1) {
      const centre = projectionFor(rotation.current).invert?.([hit.x, hit.y])
      turnToPoint(centre ?? hit.members[0].anchor)
      zoomBy(3)
      return
    }
    const country = 'members' in hit ? hit.members[0] : hit
    // The country turns to the front, so anchor the popup at the centre.
    latest.current.onPick(country, size.width / 2, size.height / 2)
    turnToCountry(country)
  }, [hitTest, kick, projectionFor, size, turnToCountry, turnToPoint, zoomBy])

  const onPointerLeave = useCallback(() => {
    hovering.current = false
    latest.current.onHover(null, 0, 0)
    kick()
  }, [kick])

  return {
    containerRef,
    canvasRef,
    zoomBy,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onPointerCancel: onPointerUp },
  }
}
