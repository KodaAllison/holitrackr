import { shortMonth, type TimelineTrip } from '../lib/timelineModel'

interface TimelineTripCardProps {
  trip: TimelineTrip
  isActive: boolean
  /** At or before the playhead: the rail dot shows green. */
  passed: boolean
  onPick: () => void
  cardRef?: (el: HTMLButtonElement | null) => void
}

/** Five stars as text, e.g. 4 → "★★★★☆". */
function stars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

/**
 * One trip in the timeline feed: a month column, then the name, place and
 * stars, notes and tags. Its dot sits on the year's rail. Clicking it moves
 * the playhead there; the active card is blue.
 */
export default function TimelineTripCard({ trip, isActive, passed, onPick, cardRef }: TimelineTripCardProps) {
  const { journal } = trip
  return (
    <button
      type="button"
      ref={cardRef}
      onClick={onPick}
      aria-current={isActive ? 'step' : undefined}
      className={`relative flex w-full gap-4 text-left rounded-xl border-2 px-4 py-3.5 text-sm text-[#1E293B] transition-[border-color,box-shadow,background-color] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${
        isActive
          ? 'border-[#2563EB] bg-[#EFF6FF] shadow-[0_4px_14px_rgba(37,99,235,0.15)]'
          : 'border-[#E4E9EE] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-[#C7D0D9]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute -left-[29px] top-5 h-3 w-3 rounded-full border-2 border-[#F8FAFC] box-content ${passed ? 'bg-[#0B7A53]' : 'bg-[#CBD5E1]'}`}
      />
      <span className="w-10 shrink-0 pt-[3px] text-xs font-bold uppercase tracking-[0.08em] text-[#5B6675]">
        {shortMonth(trip.month)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="text-[17px] font-bold">{trip.country.name}</span>
          {journal.place && <span className="text-[13px] text-[#5B6675]">{journal.place}</span>}
          {journal.rating ? (
            <span className="ml-auto text-[13px] tracking-[1px] text-[#A86B0C]" aria-label={`${journal.rating} out of 5`}>
              {stars(journal.rating)}
            </span>
          ) : null}
        </span>
        {journal.notes && <span className="leading-normal text-[#475569]">{journal.notes}</span>}
        {journal.tags && journal.tags.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {journal.tags.map(tag => (
              <span key={tag} className="rounded-[10px] bg-[#EEF2F6] px-2 py-0.5 text-xs text-[#475569]">{tag}</span>
            ))}
          </span>
        )}
      </span>
    </button>
  )
}
