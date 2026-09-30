import { useEffect, useRef } from 'react'
import type { VisitedCountry } from '../types'
import { countryKey } from '../lib/visitedCountries'
import { tripKey, type TimelineModel, type TimelineTrip } from '../lib/timelineModel'
import { formatVisitMonth, monthName } from '../lib/visitDate'

interface TimelineFeedProps {
  model: TimelineModel
  active: number
  reducedMotion: boolean
  onPick: (index: number) => void
  onOpenJournal?: (country: VisitedCountry) => void
}

function Stars({ value }: { value?: number }) {
  if (!value) return null
  return (
    <span className="text-amber-400 text-xs tracking-tight" aria-label={`${value} out of 5`}>
      {'★'.repeat(value)}<span className="text-gray-200">{'★'.repeat(5 - value)}</span>
    </span>
  )
}

function TripDetails({ trip }: { trip: TimelineTrip }) {
  const { journal } = trip
  return (
    <>
      {journal.place && <p className="text-sm text-gray-600 mt-0.5">{journal.place}</p>}
      {journal.notes && <p className="mt-2 text-sm text-gray-500 leading-relaxed">{journal.notes}</p>}
      {journal.tags && journal.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {journal.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">{tag}</span>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * The timeline's feed, oldest first: year headers (noting firsts on a
 * continent), a card per trip that moves the playhead when clicked, then the
 * planned trips and the undated countries.
 */
export default function TimelineFeed({ model, active, reducedMotion, onPick, onOpenJournal }: TimelineFeedProps) {
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
    const box = card?.closest<HTMLElement>('[data-timeline-scroll]')
    if (!card || !box || box.scrollHeight <= box.clientHeight) return
    const top = card.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
    if (top < box.scrollTop || top + card.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: top - 16, behavior: reducedMotion ? 'auto' : 'smooth' })
    }
  }, [active, reducedMotion])

  let index = 0
  return (
    <div className="space-y-8">
      {model.years.map(({ year, trips }) => {
        const firsts = trips.filter(t => t.firstIn)
        const countries = new Set(trips.map(t => countryKey(t.country))).size
        return (
          <section key={year} aria-label={String(year)}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
              <h3 className="text-2xl font-bold text-gray-800">{year}</h3>
              <span className="text-sm text-gray-400">{countries} {countries === 1 ? 'country' : 'countries'}</span>
              {firsts.map(t => (
                <span key={t.firstIn} className="text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                  First time in {t.firstIn}
                </span>
              ))}
            </div>
            <ol className="space-y-2">
              {trips.map(trip => {
                const i = index++
                const isActive = i === active
                return (
                  <li key={tripKey(trip)}>
                    <button
                      type="button"
                      ref={el => { if (el) cards.current.set(i, el); else cards.current.delete(i) }}
                      onClick={() => onPick(i)}
                      aria-current={isActive ? 'step' : undefined}
                      className={`w-full text-left bg-white rounded-xl border px-4 py-3 transition-shadow ${
                        isActive ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-sm' : 'border-gray-100 shadow-sm hover:border-gray-200'
                      } ${i > active ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-gray-400">{monthName(trip.month)}</p>
                          <p className="font-semibold text-gray-800">{trip.country.name}</p>
                        </div>
                        <Stars value={trip.journal.rating} />
                      </div>
                      <TripDetails trip={trip} />
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}

      {model.planned.length > 0 && (
        <section aria-label="Next">
          <h3 className="text-lg font-semibold text-[#9A5B00] mb-3">Next</h3>
          <ol className="space-y-2">
            {model.planned.map(trip => (
              <li key={countryKey(trip.country)} className="rounded-xl border border-dashed border-[#F2B24E] bg-amber-50/40 px-4 py-3">
                <p className="text-xs text-[#9A5B00]">Hoping to go · {formatVisitMonth(trip.journal.visitedAt)}</p>
                <p className="font-semibold text-gray-800">{trip.country.name}</p>
                <TripDetails trip={trip} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {model.undated.length > 0 && (
        <section aria-label="No date recorded">
          <h3 className="text-lg font-semibold text-gray-400 mb-3">No date recorded</h3>
          <ul className="space-y-2">
            {model.undated.map(country => (
              <li key={countryKey(country)} className="flex items-center justify-between gap-2 bg-white rounded-xl border border-gray-100 px-4 py-3">
                <span className="font-medium text-gray-600">{country.name}</span>
                {onOpenJournal && (
                  <button type="button" onClick={() => onOpenJournal(country)} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                    Add a date
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
