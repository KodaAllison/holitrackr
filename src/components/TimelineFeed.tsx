import { useEffect, useRef } from 'react'
import type { VisitedCountry } from '../types'
import { journeySummary, tripKey, yearStats, type TimelineModel } from '../lib/timelineModel'
import TimelineNextSection from './TimelineNextSection'
import TimelineTripCard from './TimelineTripCard'
import TimelineUndatedSection from './TimelineUndatedSection'

interface TimelineFeedProps {
  model: TimelineModel
  active: number
  reducedMotion: boolean
  onPick: (index: number) => void
  onOpenJournal?: (country: VisitedCountry) => void
}

/**
 * The timeline's feed panel ("Your journey"), oldest first: a header with
 * the journey's stats, then year groups hanging off a rail (a card per trip
 * that moves the playhead when clicked), the planned trips, and the undated
 * countries. On `lg` it scrolls on its own and follows the playhead.
 */
export default function TimelineFeed({ model, active, reducedMotion, onPick, onOpenJournal }: TimelineFeedProps) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const cards = useRef(new Map<number, HTMLButtonElement>())

  // Keep the active card in view as the playhead moves (e.g. while playing).
  // Only the feed's own scroll box moves, never the page, and not on mount.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const card = cards.current.get(active)
    const box = scroller.current
    if (!card || !box || box.scrollHeight <= box.clientHeight) return
    const top = card.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
    if (top < box.scrollTop || top + card.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: top - 140, behavior: reducedMotion ? 'auto' : 'smooth' })
    }
  }, [active, reducedMotion])

  const summary = journeySummary(model)
  let index = 0
  return (
    <aside aria-label="Your journey" className="flex flex-col bg-[#F8FAFC] lg:flex-1 lg:min-h-0 lg:border-l lg:border-[#D7DEE5]">
      <header className="shrink-0 bg-white border-y border-[#E4E9EE] lg:border-t-0 px-4 pt-5 pb-4 lg:px-7">
        <h2 className="text-[22px] font-bold text-[#1E293B]">Your journey</h2>
        {summary && <p className="mt-1 text-sm text-[#5B6675]">{summary}</p>}
      </header>
      <div ref={scroller} data-timeline-scroll className="relative px-4 pt-2 pb-10 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:px-7">
        {model.trips.length === 0 && (
          <p className="mt-6 text-sm text-[#5B6675]">Add when you visited each country and your journey will play out here.</p>
        )}
        {model.years.map(group => (
          <section key={group.year} aria-labelledby={`timeline-year-${group.year}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 mt-6 mb-3">
              <h3 id={`timeline-year-${group.year}`} className="text-[36px] leading-tight font-extrabold tracking-[-0.02em] tabular-nums text-[#1E293B]">
                {group.year}
              </h3>
              <span className="text-[13px] text-[#5B6675]">{yearStats(group)}</span>
            </div>
            <ol className="flex flex-col gap-2.5 ml-1.5 pl-[18px] border-l-2 border-[#D7DEE5]">
              {group.trips.map(trip => {
                const i = index++
                return (
                  <li key={tripKey(trip)}>
                    <TimelineTripCard
                      cardRef={el => { if (el) cards.current.set(i, el); else cards.current.delete(i) }}
                      trip={trip}
                      isActive={i === active}
                      passed={i <= active}
                      onPick={() => onPick(i)}
                    />
                  </li>
                )
              })}
            </ol>
          </section>
        ))}
        <TimelineNextSection planned={model.planned} />
        <TimelineUndatedSection undated={model.undated} onOpenJournal={onOpenJournal} />
      </div>
    </aside>
  )
}
