import { useState, useEffect } from 'react'
import type { Country, VisitedCountry } from '../types'
import { statusOf } from '../lib/visitedCountries'

interface CountrySearchProps {
  countries: Country[]
  visitedCountries: VisitedCountry[]
  onCountrySelect: (country: Country, status: 'visited' | 'bucketlist') => void
}

export default function CountrySearch({
  countries,
  visitedCountries,
  onCountrySelect
}: CountrySearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredCountries, setFilteredCountries] = useState<Country[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredCountries([])
      setShowDropdown(false)
      return
    }

    const filtered = countries
      .filter(country =>
        country.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, 10) // Limit to 10 results

    setFilteredCountries(filtered)
    setShowDropdown(filtered.length > 0)
  }, [searchTerm, countries])

  const handleSelect = (country: Country, status: 'visited' | 'bucketlist') => {
    onCountrySelect(country, status)
    setSearchTerm('')
    setShowDropdown(false)
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search for a country..."
          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg
          className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {showDropdown && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredCountries.map((country) => {
            const activeStatus = statusOf(visitedCountries, country)
            return (
              <div
                key={country.code}
                className="w-full px-4 py-2 hover:bg-gray-100 flex items-center justify-between gap-2 transition-colors"
              >
                <span className="font-medium">{country.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelect(country, 'visited')}
                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                      activeStatus === 'visited'
                        ? 'bg-emerald-500 text-white'
                        : 'border border-emerald-500 text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    Visited
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelect(country, 'bucketlist')}
                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                      activeStatus === 'bucketlist'
                        ? 'bg-amber-500 text-white'
                        : 'border border-amber-500 text-amber-600 hover:bg-amber-50'
                    }`}
                  >
                    Bucket List
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
