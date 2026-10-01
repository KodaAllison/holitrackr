import { useEffect, useRef, useState } from 'react'
import type { VisitedCountry } from '../types'
import type { IndexedCountry } from '../lib/mapEngine/countryIndex'
import { drawIntro } from '../lib/mapEngine/drawIntro'
import { createHatch } from '../lib/mapEngine/renderer'
import { useCanvasSize } from '../lib/mapEngine/useCanvasSize'
import { DEFAULT_GLOBE, globeRadius } from '../lib/mapEngine/views'
import { introAt, planIntro } from '../lib/introTimeline'

interface IntroMapSurfaceProps {
  countries: IndexedCountry[] | null
  statusOf: (c: IndexedCountry) => VisitedCountry['status'] | undefined
  onDone: () => void
  className: string
}

/**
 * The startup intro in place of "Loading map...": a dark globe spins in, the
 * user's countries light up as the data arrives, then it settles into the
 * light interactive globe. It never blocks input: Skip, or any press on the
 * map, ends it at once.
 */
export default function IntroMapSurface({ countries, statusOf, onDone, className }: IntroMapSurfaceProps) {
  const { containerRef, canvasRef, size } = useCanvasSize()
  const [lit, setLit] = useState(0)
  const done = useRef(onDone)
  const status = useRef(statusOf)
  useEffect(() => { done.current = onDone; status.current = statusOf })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !countries || size.width === 0) return
    const hatch = createHatch(ctx)
    const radius = globeRadius(size)
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      // Marked countries light up west to east; the list can still be
      // arriving while this plays, so it is recomputed each frame.
      const marked = countries.filter(c => status.current(c)).sort((a, b) => a.anchor[0] - b.anchor[0])
      const order = new Map(marked.map((c, i) => [c, i]))
      const plan = planIntro(marked.length)
      const state = introAt(plan, now - start, DEFAULT_GLOBE.rotate)
      drawIntro({
        ctx, ...size, dpr: window.devicePixelRatio || 1,
        cx: size.width / 2, cy: size.height / 2, radius: radius * state.scale,
        rotate: state.rotate, countries, statusOf: status.current,
        fillOf: c => state.fill(order.get(c) ?? 0), light: state.light, hatch,
      })
      setLit(marked.filter((c, i) => state.fill(i) >= 1 && status.current(c) === 'visited').length)
      if (state.done) done.current()
      else frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [canvasRef, countries, size])

  return (
    <div ref={containerRef} className={className} aria-busy={true}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full bg-[#0B1220]"
        onPointerDown={() => done.current()}
      />
      <p role="status" className="absolute inset-x-0 bottom-6 text-center text-sm font-medium text-slate-300 pointer-events-none">
        {countries ? `${lit} ${lit === 1 ? 'country' : 'countries'} visited` : 'Loading your atlas…'}
      </p>
      <button
        type="button"
        onClick={() => done.current()}
        className="absolute right-4 bottom-4 z-10 h-9 px-4 rounded-full bg-slate-900/90 text-white text-sm font-semibold shadow hover:bg-slate-900"
      >
        Skip
      </button>
    </div>
  )
}
