import { useRef } from 'react'
import { monthLabel, nearestTrip, tripAtOrBefore, type TimelineModel } from '../lib/timelineModel'
import { formatVisitMonth } from '../lib/visitDate'
import { useElementWidth } from '../lib/useElementWidth'
import TimelineRulerMarks from './TimelineRulerMarks'
import { BASE, HEIGHT, PAD } from '../lib/timelineRulerGeometry'

interface TimelineRulerProps {
  model: TimelineModel
  active: number
  playing: boolean
  onChange: (index: number) => void
  onTogglePlay: () => void
}

/** Dragging within this many px of a trip snaps to it. */
const SNAP_PX = 12

const control = 'h-9 w-9 flex items-center justify-center rounded-full border border-[#CBD5E1] bg-white text-[#1E293B] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-default'

function Chevron({ d }: { d: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

/**
 * The white time strip under the timeline map: soft per-year bars, a dot per
 * trip, the hatched "Next" zone past now, and a playhead you drag (snapping
 * to trips) or move with the arrow keys. Prev / Play / Next sit bottom-left.
 */
export default function TimelineRuler({ model, active, playing, onChange, onTogglePlay }: TimelineRulerProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const dragging = useRef(false)
  const { trips, start, end } = model
  const span = Math.max(1, end - start)
  const track = Math.max(1, width - 2 * PAD)
  const atFromX = (px: number) => start + ((px - PAD) / track) * span

  const scrubTo = (clientX: number, target: Element) => {
    const at = atFromX(clientX - target.getBoundingClientRect().left)
    const snapped = nearestTrip(trips, at, (SNAP_PX / track) * span)
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

  const current = trips[active]
  return (
    <div className="relative flex shrink-0 items-stretch h-[176px] bg-white border-t border-[#D7DEE5]">
      <div className="flex items-center gap-1.5 shrink-0 self-start pl-3 lg:pl-5" style={{ marginTop: BASE - 34 }}>
        <button type="button" aria-label="Previous trip" className={control} disabled={active <= 0} onClick={() => onChange(active - 1)}>
          <Chevron d="M15 18l-6-6 6-6" />
        </button>
        <button
          type="button"
          aria-label={playing ? 'Pause journey' : 'Play journey'}
          className="h-9 w-9 flex items-center justify-center rounded-full bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-default"
          disabled={trips.length < 2}
          onClick={onTogglePlay}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {playing
              ? <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>
              : <path d="M7 5l12 7-12 7z" />}
          </svg>
        </button>
        <button type="button" aria-label="Next trip" className={control} disabled={active >= trips.length - 1} onClick={() => onChange(active + 1)}>
          <Chevron d="M9 18l6-6-6-6" />
        </button>
      </div>
      <div ref={ref} className="relative flex-1 min-w-0">
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
            className="block touch-none select-none cursor-ew-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB]"
            onKeyDown={onKeyDown}
            onPointerDown={e => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); scrubTo(e.clientX, e.currentTarget) }}
            onPointerMove={e => { if (dragging.current) scrubTo(e.clientX, e.currentTarget) }}
            onPointerUp={() => { dragging.current = false }}
            onPointerCancel={() => { dragging.current = false }}
          >
            <TimelineRulerMarks model={model} active={active} width={width} />
            {current && (
              <Playhead x={PAD + ((current.at + 0.5 - start) / span) * track} width={width} label={monthLabel(current.at)} />
            )}
          </svg>
        )}
      </div>
    </div>
  )
}

/** The blue playhead: a line down to the axis under a month label pill. */
function Playhead({ x, width, label }: { x: number; width: number; label: string }) {
  const w = label.length * 7 + 18
  const left = Math.max(2, Math.min(width - w - 2, x - w / 2))
  return (
    <g pointerEvents="none">
      <rect x={x - 1} y={44} width={2} height={BASE - 36} fill="#2563EB" />
      <rect x={left} y={18} width={w} height={26} rx={13} fill="#2563EB" />
      <text x={left + w / 2} y={31} fontSize={12} fontWeight={700} fill="#FFFFFF" textAnchor="middle" dominantBaseline="central">{label}</text>
    </g>
  )
}
