import { useEffect, useMemo, useRef } from 'react'
import { geoInterpolate, geoPath } from 'd3-geo'
import { countryKey } from '../lib/visitedCountries'
import type { TimelineModel } from '../lib/timelineModel'
import { formatVisitMonth } from '../lib/visitDate'
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
      ctx.setLineDash([4, 4])
      legs.forEach(([a, b], i) => {
        const last = i === legs.length - 1
        const interp = geoInterpolate(a.anchor, b.anchor)
        const end = last ? progress : 1
        const n = Math.max(2, Math.ceil(48 * end))
        const coordinates = Array.from({ length: n + 1 }, (_, s) => interp((s / n) * end))
        ctx.beginPath()
        path({ type: 'LineString', coordinates })
        ctx.strokeStyle = last ? MAP_COLORS.selected : '#64748B'
        ctx.lineWidth = last ? 2 : 1.25
        ctx.stroke()
      })
      ctx.setLineDash([])
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
    <div ref={containerRef} className="relative w-full aspect-[2/1] select-none">
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full" />
      {!countries && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">Loading map...</div>
      )}
      {trip && label && (
        <div
          className="absolute z-10 -translate-y-full pointer-events-none rounded-full bg-white/95 shadow border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-800 whitespace-nowrap"
          // Anchor the pill towards the middle so it never runs off either edge.
          style={{
            left: label[0],
            top: label[1] - 10,
            transform: `translate(${label[0] < size.width * 0.3 ? -12 : label[0] > size.width * 0.7 ? -100 : -50}%, -100%)`,
          }}
        >
          {trip.country.name}
          <span className="ml-1 font-normal text-gray-500">{formatVisitMonth(trip.country.visitedAt)}</span>
        </div>
      )}
    </div>
  )
}
