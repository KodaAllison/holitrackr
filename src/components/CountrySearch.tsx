import { useEffect, useRef, useState } from 'react'
import type { Country, VisitedCountry } from '../types'
import { statusOf } from '../lib/visitedCountries'

interface CountrySearchProps {
  countries: Country[]
  visitedCountries: VisitedCountry[]
  onCountrySelect: (country: Country, status: 'visited' | 'bucketlist') => void
  /** Over the mobile map: white, shadowed, no "/" hint. Default: the app-bar field. */
  floating?: boolean
}

const MAX_RESULTS = 10

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

/** Search a country, then mark it Visited or Bucket list from the results. */
export default function CountrySearch({ countries, visitedCountries, onCountrySelect, floating }: CountrySearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const query = searchTerm.trim().toLowerCase()
  const results = query ? countries.filter(c => c.name.toLowerCase().includes(query)).slice(0, MAX_RESULTS) : []

  // "/" focuses the search from anywhere, as the hint in the field says.
  useEffect(() => {
    if (floating) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [floating])

  const handleSelect = (country: Country, status: 'visited' | 'bucketlist') => {
    onCountrySelect(country, status)
    setSearchTerm('')
  }

  return (
    <div className={`relative w-full ${floating ? '' : 'max-w-[460px]'}`}>
      <label className="relative block">
        <span className="sr-only">Search countries</span>
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B6675" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { setSearchTerm(''); e.currentTarget.blur() } }}
          placeholder={floating ? 'Search a country…' : 'Search a country to mark it…'}
          className={`w-full pl-11 text-[#1E293B] placeholder:text-[#5B6675] focus:outline-none focus:ring-2 focus:ring-[#2563EB] ${
            floating
              ? 'h-[46px] pr-3.5 rounded-[14px] bg-white text-base shadow-[0_2px_8px_rgba(15,23,42,0.16)]'
              : 'peer h-11 pr-14 rounded-xl border border-[#D7DEE5] bg-[#F7F9FB] text-[15px] focus:bg-white focus:border-transparent'
          }`}
        />
        {!floating && (
          <kbd aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 px-[7px] py-0.5 rounded-md border border-[#D7DEE5] bg-white text-xs font-sans text-[#5B6675] peer-focus:hidden">
            /
          </kbd>
        )}
      </label>

      {results.length > 0 && (
        <ul className="absolute z-40 w-full mt-1.5 py-1 bg-white border border-[#D7DEE5] rounded-xl shadow-[0_12px_40px_rgba(15,23,42,0.2)] max-h-72 overflow-y-auto">
          {results.map(country => {
            const activeStatus = statusOf(visitedCountries, country)
            return (
              <li key={country.code + country.name} className="px-4 h-12 hover:bg-[#F7F9FB] flex items-center justify-between gap-2">
                <span className="font-medium text-[#1E293B] truncate">{country.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    aria-pressed={activeStatus === 'visited'}
                    onClick={() => handleSelect(country, 'visited')}
                    className={`h-8 px-2.5 text-xs font-semibold rounded-full border transition-colors ${
                      activeStatus === 'visited'
                        ? 'bg-[#0B7A53] border-[#0B7A53] text-white'
                        : 'border-[#0B7A53] text-[#0B7A53] hover:bg-[#0B7A53]/10'
                    }`}
                  >
                    Visited
                  </button>
                  <button
                    type="button"
                    aria-pressed={activeStatus === 'bucketlist'}
                    onClick={() => handleSelect(country, 'bucketlist')}
                    className={`h-8 px-2.5 text-xs font-semibold rounded-full border transition-colors ${
                      activeStatus === 'bucketlist'
                        ? 'bg-[#F2B24E] border-[#9A5B00] text-[#5A3500]'
                        : 'border-[#D9A650] text-[#8A5A0B] hover:bg-[#F2B24E]/15'
                    }`}
                  >
                    Bucket list
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
