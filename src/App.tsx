import { useState } from 'react'
import WorldMap from './components/WorldMap'
import Header from './components/Header'
import Stats from './components/Stats'

function App() {
  const [visitedCountries, setVisitedCountries] = useState<string[]>([])

  const toggleCountry = (countryCode: string) => {
    setVisitedCountries(prev => {
      if (prev.includes(countryCode)) {
        return prev.filter(code => code !== countryCode)
      } else {
        return [...prev, countryCode]
      }
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
