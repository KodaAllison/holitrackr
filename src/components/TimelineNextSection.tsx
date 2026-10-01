import { shortMonth, tripKey, type TimelineTrip } from '../lib/timelineModel'

interface TimelineNextSectionProps {
  planned: TimelineTrip[]
}

/**
 * The feed's "Next" section: bucket-list countries with a "Hoping to go"
 * date, soonest first, on a dashed amber rail with hatched cream cards.
 */
export default function TimelineNextSection({ planned }: TimelineNextSectionProps) {
  if (planned.length === 0) return null
  return (
    <section aria-labelledby="timeline-next">
      <div className="flex flex-wrap items-baseline gap-x-3 mt-8 mb-3">
        <h3 id="timeline-next" className="text-[36px] leading-tight font-extrabold tracking-[-0.02em] text-[#9A5B00]">Next</h3>
        <span className="text-[13px] text-[#5B6675]">From your bucket list</span>
      </div>
      <ol className="flex flex-col gap-2.5 ml-1.5 pl-[18px] border-l-2 border-dashed border-[#E3B35F]">
        {planned.map(trip => {
          const detail = trip.journal.notes ?? trip.journal.place
          return (
            <li
              key={tripKey(trip)}
              className="flex gap-4 rounded-xl border border-dashed border-[#C27A0A] bg-[repeating-linear-gradient(135deg,#FFFBF2_0_8px,#FDF1DB_8px_16px)] px-4 py-3.5 text-sm text-[#1E293B]"
            >
              <span className="w-10 shrink-0 pt-[3px] text-xs font-bold uppercase tracking-[0.08em] text-[#9A5B00]">
                {shortMonth(trip.month)}<br />{trip.year}
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] font-bold">{trip.country.name}</span>
                <span className="block mt-1 text-[#475569]">Hoping to go{detail ? ` · ${detail}` : ''}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
