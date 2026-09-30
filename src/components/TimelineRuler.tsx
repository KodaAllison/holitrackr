import { useRef } from 'react'
import { nearestTrip, tripAtOrBefore, tripKey, type TimelineModel } from '../lib/timelineModel'
import { formatVisitMonth } from '../lib/visitDate'
import { useElementWidth } from '../lib/useElementWidth'

interface TimelineRulerProps {
  model: TimelineModel
  active: number
  playing: boolean
  onChange: (index: number) => void
  onTogglePlay: () => void
}

const PAD = 16
const HEIGHT = 84
const BASE = 56
/** Dragging within this many px of a trip snaps to it. */
const SNAP_PX = 12

const control = 'h-9 w-9 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40'

/**
 * The time ruler under the timeline map: a bar per year, a dot per trip,
 * the hatched "Next" zone past now, and a playhead you drag (snapping to
 * trips) or move with the arrow keys. Prev / Play / Next sit alongside.
 */
export default function TimelineRuler({ model, active, playing, onChange, onTogglePlay }: TimelineRulerProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const dragging = useRef(false)
  const { trips, planned, start, end, now } = model
  const span = Math.max(1, end - start)
  const x = (at: number) => PAD + ((at - start) / span) * Math.max(1, width - 2 * PAD)
  const atFromX = (px: number) => start + ((px - PAD) / Math.max(1, width - 2 * PAD)) * span

  const years: number[] = []
  for (let y = Math.floor(start / 12); y <= Math.floor(end / 12); y++) years.push(y)
  const perYear = new Map<number, number>()
  for (const t of trips) perYear.set(t.year, (perYear.get(t.year) ?? 0) + 1)
  const maxPerYear = Math.max(1, ...perYear.values())

  const scrubTo = (clientX: number, target: Element) => {
    const at = atFromX(clientX - target.getBoundingClientRect().left)
    const toleranceMonths = (SNAP_PX / Math.max(1, width - 2 * PAD)) * span
    const snapped = nearestTrip(trips, at, toleranceMonths)
    const index = snapped ?? tripAtOrBefore(trips, at)
    if (index >= 0 && index !== active) onChange(index)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const next = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? active + 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? active - 1
      : e.key === 'Home' ? 0
      : e.key === 'End' ? trips.length - 1
      : null
    if (next === null) return
    e.preventDefault()
    onChange(Math.min(trips.length - 1, Math.max(0, next)))
  }

  // Label every Nth year so labels never collide on narrow screens.
  const pxPerYear = (12 / span) * Math.max(1, width - 2 * PAD)
  const labelEvery = Math.max(1, Math.ceil(30 / pxPerYear))

  const current = trips[active]
  const nowX = x(now + 0.5)

  return (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 pb-3">
      <div className="flex items-center justify-center gap-1.5 shrink-0">
        <button type="button" aria-label="Previous trip" className={control} disabled={active <= 0} onClick={() => onChange(active - 1)}>‹</button>
        <button type="button" aria-label={playing ? 'Pause' : 'Play your journey'} className={`${control} !bg-blue-600 !text-white !border-blue-600 hover:!bg-blue-700`} disabled={trips.length < 2} onClick={onTogglePlay}>
          {playing ? '❚❚' : '▶'}
        </button>
        <button type="button" aria-label="Next trip" className={control} disabled={active >= trips.length - 1} onClick={() => onChange(active + 1)}>›</button>
      </div>
      <div ref={ref} className="relative flex-1 min-w-0 w-full">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="slider"
            tabIndex={0}
            aria-label="Journey timeline"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, trips.length - 1)}
            aria-valuenow={active}
            aria-valuetext={current ? `${current.country.name}, ${formatVisitMonth(current.journal.visitedAt)}` : 'No trips'}
            className="block touch-none select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            onKeyDown={onKeyDown}
            onPointerDown={e => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); scrubTo(e.clientX, e.currentTarget) }}
            onPointerMove={e => { if (dragging.current) scrubTo(e.clientX, e.currentTarget) }}
            onPointerUp={() => { dragging.current = false }}
            onPointerCancel={() => { dragging.current = false }}
          >
            <defs>
              <pattern id="timeline-next" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="#F2B24E" strokeWidth="2" />
              </pattern>
            </defs>
            {nowX < width - PAD && (
              <rect x={nowX} y={14} width={width - PAD - nowX} height={BASE - 14} fill="url(#timeline-next)" opacity={0.35} />
            )}
            <line x1={PAD} x2={width - PAD} y1={BASE} y2={BASE} stroke="#CBD5E1" />
            {years.map(y => {
              const count = perYear.get(y) ?? 0
              const h = count ? 6 + (count / maxPerYear) * 22 : 0
              const yx = x(y * 12)
              return (
                <g key={y}>
                  <line x1={yx} x2={yx} y1={BASE} y2={BASE + 5} stroke="#CBD5E1" />
                  {count > 0 && <rect x={x(y * 12 + 1)} y={BASE - h} width={Math.max(2, x(y * 12 + 11) - x(y * 12 + 1))} height={h} rx={2} fill="#0B7A53" opacity={0.18} />}
                  {(y - years[0]) % labelEvery === 0 && (
                    <text x={yx + 3} y={BASE + 18} fontSize={10} fill="#6B7280">{y}</text>
                  )}
                </g>
              )
            })}
            <line x1={nowX} x2={nowX} y1={10} y2={BASE} stroke="#94A3B8" strokeDasharray="2 2" />
            <text x={nowX + 3} y={12} fontSize={9} fill="#64748B">Now</text>
            {planned.length > 0 && width - PAD - nowX > 56 && (
              <text x={width - PAD} y={12} fontSize={9} fill="#9A5B00" textAnchor="end">Next</text>
            )}
            {trips.map((t, i) => (
              <circle key={tripKey(t)} cx={x(t.at + 0.5)} cy={BASE} r={i <= active ? 4 : 3}
                fill={i <= active ? '#0B7A53' : '#FFFFFF'} stroke="#0B7A53" strokeWidth={1.2} />
            ))}
            {planned.map(t => (
              <circle key={`p-${tripKey(t)}`} cx={x(t.at + 0.5)} cy={BASE} r={3.5}
                fill="#F2B24E" stroke="#9A5B00" strokeWidth={1} />
            ))}
            {current && (
              <g transform={`translate(${x(current.at + 0.5)} 0)`}>
                <line y1={18} y2={BASE + 6} stroke="#2563EB" strokeWidth={2} />
                <circle cy={BASE} r={7} fill="#FFFFFF" stroke="#2563EB" strokeWidth={2.5} />
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  )
}
