import { useState, useEffect } from 'react'
import type { Country, VisitedCountry } from './types'
import WorldMap from './components/WorldMap'
import Header from './components/Header'
import Footer from './components/Footer'
import Stats from './components/Stats'
import CountrySearch from './components/CountrySearch'
import VisitedCountriesList from './components/VisitedCountriesList.tsx'
import AuthForm from './components/AuthForm'
import UserMenu from './components/UserMenu'
import { useSession } from './lib/auth-client'

const STORAGE_KEY_PREFIX = 'holitrackr-visited-countries'

function loadVisitedCountries(userId?: string): VisitedCountry[] {
  if (!userId) return []
  try {
    const storageKey = `${STORAGE_KEY_PREFIX}-${userId}`
    const stored = localStorage.getItem(storageKey)
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
  const { data: session, isPending } = useSession()
  const [visitedCountries, setVisitedCountries] = useState<VisitedCountry[]>([])
  const [countries, setCountries] = useState<Country[]>([])

  // Load visited countries when user session is available
  useEffect(() => {
    if (session?.user?.id) {
      setVisitedCountries(loadVisitedCountries(session.user.id))
    }
  }, [session?.user?.id])

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
    if (!session?.user?.id) return
    try {
      const storageKey = `${STORAGE_KEY_PREFIX}-${session.user.id}`
      localStorage.setItem(storageKey, JSON.stringify(visitedCountries))
    } catch (err) {
      console.warn('Failed to persist visited countries:', err)
    }
  }, [visitedCountries, session?.user?.id])

  // Show loading state while checking authentication
  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show auth form if not logged in
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <AuthForm />
        </div>
        <Footer />
      </div>
    )
  }

  // Show main app if logged in
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      {/* User Menu */}
      <div className="flex justify-end px-4 py-3">
        <UserMenu user={{ name: session.user.name, email: session.user.email }} />
      </div>

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
