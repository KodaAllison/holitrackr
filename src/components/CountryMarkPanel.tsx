import { useEffect, useRef } from 'react'
import type { Country, VisitedCountry } from '../types'
import { getContinent } from '../lib/continents'

type Status = VisitedCountry['status']

interface CountryMarkPanelProps {
  country: Country
  onBack: () => void
  onMark: (status: Status) => void
}

const BUTTON = 'flex h-11 items-center justify-center whitespace-nowrap rounded-[10px] border-[1.5px] bg-white text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1'

/**
 * An unmarked country opened from the map: its name and the two ways to mark
 * it. Once marked, the sidebar swaps this for the full detail panel. Esc closes it.
 */
export default function CountryMarkPanel({ country, onBack, onMark }: CountryMarkPanelProps) {
  const back = useRef(onBack)
  useEffect(() => { back.current = onBack })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) back.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between px-3 pt-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 items-center gap-1 rounded-lg pl-1.5 pr-3 text-sm font-medium text-[#334155] hover:bg-[#F7F9FB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          All countries
        </button>
        <button
          type="button"
          onClick={onBack}
          aria-label="Close (Esc)"
          title="Close (Esc)"
          className="flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-[#F7F9FB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6675" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div className="flex flex-col gap-[18px] px-5 pb-4 pt-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5B6675]">{getContinent(country.code, country.name)}</span>
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.01em] text-[#1E293B]">{country.name}</h2>
          <p className="text-sm text-[#5B6675]">Not marked yet</p>
        </div>
        <div role="group" aria-label="Mark as" className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => onMark('visited')} className={`${BUTTON} border-[#7FBFA6] text-[#0B7A53] hover:bg-[#F0F8F4]`}>
            Visited
          </button>
          <button type="button" onClick={() => onMark('bucketlist')} className={`${BUTTON} border-[#D9A650] text-[#8A5A0B] hover:bg-[#FFFBF2]`}>
            Bucket list
          </button>
        </div>
        <p className="text-[13px] leading-normal text-[#5B6675]">Mark it to add dates, a rating, tags and notes.</p>
      </div>
    </div>
  )
}
