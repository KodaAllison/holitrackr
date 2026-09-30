import { useEffect, useMemo, useRef } from 'react'
import { geoInterpolate, geoPath } from 'd3-geo'
import { countryKey } from '../lib/visitedCountries'
import { countriesAsOf, shortMonth, type TimelineModel } from '../lib/timelineModel'
import type { IndexedCountry } from '../lib/mapEngine/countryIndex'
import { MAP_COLORS } from '../lib/mapEngine/palette'
import { createHatch, drawMap, ShapeCache } from '../lib/mapEngine/renderer'
import { useCanvasSize } from '../lib/mapEngine/useCanvasSize'
import { useWorldCountries } from '../lib/mapEngine/useWorldCountries'
import { flatProjection } from '../lib/mapEngine/views'

interface TimelineMapProps {
  model: TimelineModel
  active: number
  reducedMotion: boolean
}

const LEG_MS = 700
const IDENTITY = { k: 1, x: 0, y: 0 }

/**
 * The timeline's map: countries fill in up to the active trip, dashed
 * great-circle legs join the trips in order, and the newest leg draws itself
 * in when the playhead moves.
 */
export default function TimelineMap({ model, active, reducedMotion }: TimelineMapProps) {
  const { countries } = useWorldCountries()
  const { containerRef, canvasRef, size } = useCanvasSize()
  const projection = useMemo(() => flatProjection(size), [size])
  const shapes = useMemo(() => new ShapeCache(projection), [projection])
  const byKey = useMemo(() => new Map((countries ?? []).map(c => [countryKey(c.identity), c])), [countries])
  const hatch = useRef<CanvasPattern | null>(null)

  const trip = model.trips[active]
  const anchorOf = (i: number): IndexedCountry | undefined => {
    const t = model.trips[i]
    return t && byKey.get(countryKey(t.country))
  }
  const activeCountry = anchorOf(active)
  const label = activeCountry && projection(activeCountry.anchor)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !countries || size.width === 0) return
    hatch.current ??= createHatch(ctx)
    const visited = new Set(model.trips.slice(0, active + 1).map(t => countryKey(t.country)))
    const dpr = window.devicePixelRatio || 1
    const path = geoPath(projection, ctx)
    const legs: [IndexedCountry, IndexedCountry][] = []
    for (let i = 1; i <= active; i++) {
      const a = anchorOf(i - 1)
      const b = anchorOf(i)
      if (a && b && a !== b) legs.push([a, b])
    }

    const draw = (progress: number) => {
      drawMap({
        ctx, ...size, dpr, shapes, transform: IDENTITY, countries,
        statusOf: c => (visited.has(countryKey(c.identity)) ? 'visited' : undefined),
        hoveredKey: null, selectedKey: activeCountry ? countryKey(activeCountry.identity) : null, hatch: hatch.current,
      })
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Older legs dashed and quiet; the newest one solid blue, drawing in.
      legs.forEach(([a, b], i) => {
        const last = i === legs.length - 1
        const interp = geoInterpolate(a.anchor, b.anchor)
        const end = last ? progress : 1
        const n = Math.max(2, Math.ceil(48 * end))
        const coordinates = Array.from({ length: n + 1 }, (_, s) => interp((s / n) * end))
        ctx.setLineDash(last ? [] : [3, 4])
        ctx.beginPath()
        path({ type: 'LineString', coordinates })
        ctx.strokeStyle = last ? MAP_COLORS.selected : 'rgba(30,41,59,0.45)'
        ctx.lineWidth = last ? 2.5 : 1.2
        ctx.stroke()
      })
      ctx.setLineDash([])
      // A stop per trip so far, the active one ringed in blue.
      for (let i = 0; i <= active; i++) {
        const stop = anchorOf(i)
        const p = stop && projection(stop.anchor)
        if (!p) continue
        ctx.beginPath()
        ctx.arc(p[0], p[1], i === active ? 5 : 3, 0, 2 * Math.PI)
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()
        ctx.strokeStyle = i === active ? MAP_COLORS.selected : MAP_COLORS.visited
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }

    if (reducedMotion || legs.length === 0) {
      draw(1)
      return
    }
    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / LEG_MS)
      draw(1 - Math.pow(1 - u, 3))
      if (u < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // anchorOf/activeCountry derive from model, active and byKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, countries, model, active, byKey, shapes, projection, size, reducedMotion])

  return (
    <div ref={containerRef} className="relative w-full aspect-[2/1] lg:aspect-auto lg:flex-1 lg:min-h-[240px] select-none">
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full" />
      {!countries && (
        <div className="absolute inset-0 flex items-center justify-center text-[#5B6675] text-sm">Loading map...</div>
      )}
      {trip && (
        <p className="absolute left-3 top-3 lg:left-5 lg:top-5 z-10 rounded-[10px] bg-white/[.94] px-3.5 py-2.5 text-[13px] lg:text-sm text-[#334155] shadow-[0_1px_3px_rgba(15,23,42,0.15)]">
          Your atlas in <strong className="text-[#1E293B]">{shortMonth(trip.month)} {trip.year}</strong>
          {' · '}<strong className="text-[#0B7A53]">{countriesAsOf(model.trips, active)}</strong> countries
        </p>
      )}
      {trip && label && (
        <div
          className="absolute z-10 pointer-events-none rounded-full bg-white px-2.5 h-[26px] leading-[26px] text-[13px] font-semibold text-[#1E293B] whitespace-nowrap shadow-[0_2px_8px_rgba(15,23,42,0.2)]"
          // Anchor the pill towards the middle so it never runs off either edge.
          style={{
            left: label[0],
            top: label[1] - 10,
            transform: `translate(${label[0] < size.width * 0.3 ? -12 : label[0] > size.width * 0.7 ? -100 : -50}%, -100%)`,
          }}
        >
          {trip.country.name} · {shortMonth(trip.month)} {trip.year}
        </div>
      )}
    </div>
  )
}
