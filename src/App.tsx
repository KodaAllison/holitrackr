import { useState } from 'react'
import WorldMap from './components/WorldMap'
import Header from './components/Header'
import Stats from './components/Stats'

function App() {
  const [visitedCountries, setVisitedCountries] = useState<string[]>([])

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
      <WorldMap 
        visitedCountries={visitedCountries} 
        onCountryClick={toggleCountry} 
      />
    </div>
  )
}

export default App
