import type { VisitedCountry } from '../types'
import { getContinent } from '../lib/continents'
import { countrySummary } from '../lib/mobileSheet'
import { useFocusOnMount } from '../lib/useFocusOnMount'
import StatusControl from './StatusControl'

type Status = VisitedCountry['status']

interface MobileCountrySummaryProps {
  country: VisitedCountry
  onClose: () => void
  onSetStatus: (status: Status) => void
  onRemove: () => void
  onEditJournal: () => void
}

/**
 * Below `lg`, a selected country's collapsed sheet: continent, name, a
 * summary line ("June 2023 · ★★★★ · Food, History"), the status buttons and
 * "Edit journal", which expands the sheet into the full detail panel.
 */
export default function MobileCountrySummary({ country, onClose, onSetStatus, onRemove, onEditJournal }: MobileCountrySummaryProps) {
  const summary = countrySummary(country)
  const heading = useFocusOnMount<HTMLHeadingElement>()
  return (
    <div className="flex flex-col gap-3.5 px-5 pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5B6675]">{getContinent(country.code, country.name)}</span>
          <h2 ref={heading} tabIndex={-1} className="truncate focus:outline-none text-[26px] font-bold leading-tight tracking-[-0.01em] text-[#1E293B]">{country.name}</h2>
          <p className="text-sm text-[#5B6675]">
            {summary.text}
            {summary.stars && <> · <span className="text-[#A86B0C]" aria-label={`${summary.stars.length} out of 5`}>{summary.stars}</span></>}
            {summary.tags && <> · {summary.tags}</>}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 -mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF2F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <StatusControl status={country.status} onSetStatus={onSetStatus} onRemove={onRemove} large />
      <button
        type="button"
        onClick={onEditJournal}
        className="flex h-[50px] items-center justify-center gap-2 rounded-xl bg-[#2563EB] text-[15px] font-semibold text-white hover:bg-[#1D4ED8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /><path d="M9 8h6" />
        </svg>
        Edit journal
      </button>
    </div>
  )
}
