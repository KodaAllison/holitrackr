import { useEffect, useRef, type ReactNode } from 'react'
import type { VisitedCountry } from '../types'
import type { IndexedCountry } from '../lib/mapEngine/countryIndex'
import { drawMorph } from '../lib/mapEngine/drawMorph'
import { ease } from '../lib/mapEngine/globeMotion'
import { createHatch } from '../lib/mapEngine/renderer'
import { useCanvasSize } from '../lib/mapEngine/useCanvasSize'
import {
  clampView, coverView, FLAT_MAX_ZOOM, flatFrame, flatLimits, globeLon, globeRadius, NO_INSET, type FlatView, type GlobeView,
} from '../lib/mapEngine/views'

interface MorphMapSurfaceProps {
  direction: 'toFlat' | 'toGlobe'
  globe: GlobeView
  /** Where the flat view is; null for the opening view (the World view about the globe's meridian). */
  flat: FlatView | null
  countries: IndexedCountry[]
  statusOf: (c: IndexedCountry) => VisitedCountry['status'] | undefined
  onDone: () => void
  className: string
  children?: ReactNode
}

const DURATION = 1100

/** Plays the globe ⇄ flat unroll once, then calls `onDone`. */
export default function MorphMapSurface({
  direction, globe, flat, countries, statusOf, onDone, className, children,
}: MorphMapSurfaceProps) {
  const { containerRef, canvasRef, size } = useCanvasSize()
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || size.width === 0) return
    // The flat view the morph starts or lands on is the one useFlatMap draws: same limits and
    // meridian (it opens on the globe's), so no jump at the end.
    const limits = flatLimits(size, NO_INSET, FLAT_MAX_ZOOM)
    const view = clampView(flat ?? coverView(limits, globeLon(globe)), limits)
    const hatch = createHatch(ctx)
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / DURATION)
      const e = ease(u)
      drawMorph({
        ctx, ...size, dpr: window.devicePixelRatio || 1,
        t: direction === 'toFlat' ? e : 1 - e,
        globe: { rotate: globe.rotate, scale: globeRadius(size) * globe.zoom, translate: [size.width / 2, size.height / 2] },
        flat: flatFrame(limits, view),
        countries, statusOf, hatch,
      })
      if (u < 1) frame = requestAnimationFrame(step)
      else done.current()
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [canvasRef, size, direction, globe, flat, countries, statusOf])

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full" />
      {children}
    </div>
  )
}
