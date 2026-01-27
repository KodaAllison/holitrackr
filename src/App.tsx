import { useState } from 'react'
import type { Country } from './types'
import WorldMap from './components/WorldMap'
import Header from './components/Header'
import Stats from './components/Stats'
import CountrySearch from './components/CountrySearch'

function App() {
  const [visitedCountries, setVisitedCountries] = useState<string[]>([])
  const [countries, setCountries] = useState<Country[]>([])

  const toggleCountry = (countryCode: string) => {
    console.log('Toggle country called with:', countryCode)
    setVisitedCountries(prev => {
      const newState = prev.includes(countryCode)
        ? prev.filter(code => code !== countryCode)
        : [...prev, countryCode]
      console.log('New visited countries:', newState)
      return newState
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Stats visitedCount={visitedCountries.length} />
      
      {/* Search Bar */}
      <div className="container mx-auto px-4 py-4">
        <CountrySearch 
          countries={countries}
          visitedCountries={visitedCountries}
          onCountrySelect={toggleCountry}
        />
      </div>

      <WorldMap 
        visitedCountries={visitedCountries} 
        onCountryClick={toggleCountry}
        onCountriesLoaded={setCountries}
      />
    </div>
  )
}

export default App
