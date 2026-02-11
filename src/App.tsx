import { useState } from 'react'
import type { Country, VisitedCountry } from './types'
import WorldMap from './components/WorldMap'
import Header from './components/Header'
import Stats from './components/Stats'
import CountrySearch from './components/CountrySearch'
import VisitedCountriesList from './components/VisitedCountriesList.tsx'

function App() {
  const [visitedCountries, setVisitedCountries] = useState<VisitedCountry[]>([])
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

  return (
    <div className="min-h-screen bg-gray-50">
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
          <div className="h-[420px] max-h-[420px]">
            <VisitedCountriesList
              visitedCountries={visitedCountries}
              onRemove={toggleCountry}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
