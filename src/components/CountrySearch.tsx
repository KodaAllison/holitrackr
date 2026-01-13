import { useState, useEffect } from 'react'

interface Country {
  name: string
  code: string
}

interface CountrySearchProps {
  countries: Country[]
  visitedCountries: string[]
  onCountrySelect: (countryCode: string) => void
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

  const handleSelect = (country: Country) => {
    onCountrySelect(country.code)
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
            const isVisited = visitedCountries.includes(country.code)
            return (
              <button
                key={country.code}
                onClick={() => handleSelect(country)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-between transition-colors"
              >
                <span className="font-medium">{country.name}</span>
                {isVisited && (
                  <span className="text-green-600 text-sm">✓ Visited</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
