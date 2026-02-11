import { useState, useEffect } from 'react'
import type { Country, VisitedCountry } from './types'
import WorldMap from './components/WorldMap'
import Header from './components/Header'
import Footer from './components/Footer'
import Stats from './components/Stats'
import CountrySearch from './components/CountrySearch'
import VisitedCountriesList from './components/VisitedCountriesList.tsx'

const STORAGE_KEY = 'holitrackr-visited-countries'

function loadVisitedCountries(): VisitedCountry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (c): c is VisitedCountry =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as VisitedCountry).code === 'string' &&
        typeof (c as VisitedCountry).name === 'string'
    )
  } catch {
    return []
  }
}

function App() {
  const [visitedCountries, setVisitedCountries] = useState<VisitedCountry[]>(
    loadVisitedCountries
  )
  const [countries, setCountries] = useState<Country[]>([])

  const toggleCountry = (country: VisitedCountry | Country) => {
    setVisitedCountries(prev => {
      const isVisited = prev.some(
        v => v.code === country.code && v.name === country.name
      )
      return isVisited
        ? prev.filter(v => !(v.code === country.code && v.name === country.name))
        : [...prev, country]
    })
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visitedCountries))
    } catch (err) {
      console.warn('Failed to persist visited countries:', err)
    }
  }, [visitedCountries])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <Stats visitedCount={visitedCountries.length} />
      
      {/* Search Bar */}
      <div className="flex justify-center px-4 py-4">
        <CountrySearch 
          countries={countries}
          visitedCountries={visitedCountries}
          onCountrySelect={toggleCountry}
        />
      </div>

      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            <WorldMap 
              visitedCountries={visitedCountries} 
              onCountryClick={(code, name) => toggleCountry({ code, name })}
              onCountriesLoaded={setCountries}
            />
          </div>
          <div className="h-[420px] max-h-[420px] mb-4">
            <VisitedCountriesList
              visitedCountries={visitedCountries}
              onRemove={toggleCountry}
              onReset={() => setVisitedCountries([])}
            />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default App
