import type { VisitedCountry } from '../types'
import { rowSubline } from '../lib/countryListModel'
import { mobileRowSubline } from '../lib/mobileSheet'
import { countryKey } from '../lib/visitedCountries'

type Status = VisitedCountry['status']

interface CountryRowProps {
  country: VisitedCountry
  onSelect: (country: VisitedCountry) => void
  onSetStatus: (country: VisitedCountry, status: Status) => void
}

/**
 * One list row: name and a sub-line ("Jun 2023 · ★★★★ · Food"). Only the
 * focused (or hovered) row shows its action pill, which flips the status.
 * Below `lg` the sub-line is "Europe · May 2018" and a › chevron replaces the pill.
 */
export default function CountryRow({ country, onSelect, onSetStatus }: CountryRowProps) {
  const sub = rowSubline(country)
  const toBucket = country.status === 'visited'
  const next: Status = toBucket ? 'bucketlist' : 'visited'

  return (
    <li
      className="group flex h-[52px] items-center gap-2.5 rounded-[10px] pr-2 hover:bg-[#F7F9FB] has-[:focus-visible]:bg-[#F5F8FF] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-[#2563EB]"
    >
      <button
        type="button"
        data-row={countryKey(country)}
        onClick={() => onSelect(country)}
        className="flex h-full min-w-0 flex-1 flex-col justify-center pl-2 text-left focus:outline-none"
      >
        <span className="block truncate text-[15px] font-semibold text-[#1E293B]">{country.name}</span>
        <span className="block truncate text-xs text-[#5B6675] lg:hidden">{mobileRowSubline(country)}</span>
        <span className="hidden truncate text-xs text-[#5B6675] lg:block">
          {sub.text}
          {sub.stars && <> · <span className="text-[#A86B0C]" aria-label={`${sub.stars.length} out of 5`}>{sub.stars}</span></>}
          {sub.tags && <> · {sub.tags}</>}
        </span>
      </button>
      <button
        type="button"
        aria-label={toBucket ? `Move ${country.name} to bucket list` : `Mark ${country.name} as visited`}
        onClick={() => onSetStatus(country, next)}
        className="hidden h-11 shrink-0 items-center focus:outline-none lg:group-hover:flex lg:group-has-[:focus-visible]:flex [&:focus-visible>span]:ring-2 [&:focus-visible>span]:ring-[#2563EB]"
      >
        <span
          className={`flex h-[30px] items-center whitespace-nowrap rounded-full border bg-white px-2.5 text-xs font-semibold ${
            toBucket ? 'border-[#D9A650] text-[#8A5A0B]' : 'border-[#7FBFA6] text-[#0B7A53]'
          }`}
        >
          {toBucket ? 'Move to bucket list' : 'Mark visited'}
        </span>
      </button>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 lg:hidden">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </li>
  )
}
