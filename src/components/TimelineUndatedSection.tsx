import type { VisitedCountry } from '../types'
import { countryKey } from '../lib/visitedCountries'

interface TimelineUndatedSectionProps {
  undated: VisitedCountry[]
  onOpenJournal?: (country: VisitedCountry) => void
}

/**
 * The feed's "No date recorded" section: visited countries with no dated
 * visit, each with an "Add a date" button that opens its journal.
 */
export default function TimelineUndatedSection({ undated, onOpenJournal }: TimelineUndatedSectionProps) {
  if (undated.length === 0) return null
  return (
    <section aria-labelledby="timeline-undated">
      <div className="flex flex-wrap items-baseline gap-x-3 mt-8 mb-3">
        <h3 id="timeline-undated" className="text-lg font-bold text-[#5B6675]">No date recorded</h3>
        <span className="text-[13px] text-[#5B6675]">{undated.length} {undated.length === 1 ? 'country' : 'countries'}</span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {undated.map(country => (
          <li key={countryKey(country)} className="flex items-center gap-4 rounded-xl border border-[#E4E9EE] bg-white px-4 py-3.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold text-[#1E293B]">{country.name}</span>
              <span className="block mt-0.5 text-[#5B6675]">Add when you went to place it on your journey.</span>
            </span>
            {onOpenJournal && (
              <button
                type="button"
                onClick={() => onOpenJournal(country)}
                className="h-9 shrink-0 rounded-lg border border-[#2563EB] bg-white px-3.5 text-sm font-semibold text-[#1D4ED8] hover:bg-[#EFF6FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
              >
                Add a date
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
