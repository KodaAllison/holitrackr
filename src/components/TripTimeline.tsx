import { useEffect, useMemo, useState } from 'react'
import type { VisitedCountry } from '../types'
import { withStatus } from '../lib/visitedCountries'
import { buildTimeline } from '../lib/timelineModel'
import { useMediaQuery } from '../lib/useMediaQuery'
import TimelineFeed from './TimelineFeed'
import TimelineMap from './TimelineMap'
import TimelineRuler from './TimelineRuler'

interface TripTimelineProps {
  visitedCountries: VisitedCountry[]
  onOpenJournal?: (country: VisitedCountry) => void
}

/** How long Play lingers on each trip. */
const STEP_MS = 1400

/**
 * Timeline v2: scrub your journey. Full-bleed, filling the slot it is given:
 * the map and ruler on the left (~60%), the feed (oldest first) on the right.
 * The map fills in as the playhead moves; Play steps through every trip.
 * Below `lg` the two stack and the whole view scrolls.
 */
export default function TripTimeline({ visitedCountries, onOpenJournal }: TripTimelineProps) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const model = useMemo(() => buildTimeline(visitedCountries, new Date()), [visitedCountries])
  const [chosen, setChosen] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const last = model.trips.length - 1
  // Default to the newest trip; a choice past the end (after a removal) clamps.
  const active = chosen === null ? last : Math.min(chosen, last)
  const visited = withStatus(visitedCountries, 'visited')

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setChosen(i => {
        const next = (i ?? last) + 1
        if (next >= last) setPlaying(false)
        return Math.min(next, last)
      })
    }, STEP_MS)
    return () => window.clearInterval(timer)
  }, [playing, last])

  const togglePlay = () => {
    if (playing) return setPlaying(false)
    // From the end, Play restarts the journey from the first trip.
    if (active >= last) setChosen(0)
    setPlaying(true)
  }
  const pick = (i: number) => { setPlaying(false); setChosen(i) }

  if (visited.length === 0) {
    return (
      <div className="h-full min-h-[320px] flex flex-col items-center justify-center bg-[#F8FAFC] px-4 text-center text-[#5B6675]">
        <svg className="w-10 h-10 mb-4 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-[15px] font-semibold text-[#1E293B]">No trips yet</p>
        <p className="text-sm mt-1">Mark countries as visited on the map to see your journey here.</p>
      </div>
    )
  }

  const hasTrips = model.trips.length > 0
  return (
    <div className="h-full min-h-0 flex flex-col overflow-y-auto lg:flex-row lg:overflow-hidden lg:max-h-[calc(100vh-64px)] text-[#1E293B]">
      {hasTrips && (
        <section aria-label="Journey map and time scrubber" className="flex flex-col shrink-0 bg-[#DCE6EE] lg:w-[60%] lg:min-h-0">
          <TimelineMap model={model} active={active} reducedMotion={reducedMotion} />
          <TimelineRuler model={model} active={active} playing={playing} onChange={pick} onTogglePlay={togglePlay} />
        </section>
      )}
      <TimelineFeed
        model={model}
        active={hasTrips ? active : -1}
        reducedMotion={reducedMotion}
        onPick={pick}
        onOpenJournal={onOpenJournal}
      />
    </div>
  )
}
