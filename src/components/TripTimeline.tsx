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
 * Timeline v2: scrub your journey. The map fills in as the playhead moves
 * along the ruler; the feed (oldest first) follows it. Play steps through
 * every trip in order.
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
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-12 h-12 mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">No visited countries yet.</p>
        <p className="text-xs mt-1">Mark countries as visited on the map to see your timeline.</p>
      </div>
    )
  }

  if (model.trips.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-sm text-gray-500 mb-6">
          Add when you visited each country and your journey will play out here.
        </p>
        <TimelineFeed model={model} active={-1} reducedMotion={reducedMotion} onPick={pick} onOpenJournal={onOpenJournal} />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      <div className="lg:col-span-3 lg:sticky lg:top-4 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <TimelineMap model={model} active={active} reducedMotion={reducedMotion} />
        <TimelineRuler model={model} active={active} playing={playing} onChange={pick} onTogglePlay={togglePlay} />
      </div>
      <div data-timeline-scroll className="lg:col-span-2 lg:max-h-[640px] lg:overflow-y-auto lg:pr-1">
        <TimelineFeed model={model} active={active} reducedMotion={reducedMotion} onPick={pick} onOpenJournal={onOpenJournal} />
      </div>
    </div>
  )
}
