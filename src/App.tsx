import { useState, useEffect } from 'react'
import type { Country, VisitedCountry } from './types'
import WorldMap from './components/WorldMap'
import Header from './components/Header'
import Footer from './components/Footer'
import Stats from './components/Stats'
import CountrySearch from './components/CountrySearch'
import VisitedCountriesList from './components/VisitedCountriesList.tsx'
import TripTimeline from './components/TripTimeline'
import CountryDetailModal from './components/CountryDetailModal'
import AuthForm from './components/AuthForm'
import { useSession } from './lib/auth-client'
import {
  httpCountriesClient,
  type CountriesClient,
  type CountryJournalUpdates,
} from './lib/countriesClient'
import { sameCountry, findCountry, withStatus } from './lib/visitedCountries'

const STORAGE_KEY_PREFIX = 'myatlas-visited-countries'
const LEGACY_STORAGE_KEY_PREFIX = 'holitrackr-visited-countries'

function parseCountries(raw: string | null): VisitedCountry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (c): c is Record<string, unknown> =>
          typeof c === 'object' &&
          c !== null &&
          typeof (c as Record<string, unknown>).code === 'string' &&
          typeof (c as Record<string, unknown>).name === 'string'
      )
      .map((c): VisitedCountry => ({
        code: c.code as string,
        name: c.name as string,
        status:
          c.status === 'visited' || c.status === 'bucketlist'
            ? c.status
            : 'visited',
      }))
  } catch {
    return []
  }
}

function loadVisitedCountries(userId?: string): VisitedCountry[] {
  if (!userId) return []
  try {
    const userKey = `${STORAGE_KEY_PREFIX}-${userId}`
    const stored = localStorage.getItem(userKey)
    if (stored) return parseCountries(stored)

    // One-time migration from legacy key (pre-auth)
    const legacyUserKey = `${LEGACY_STORAGE_KEY_PREFIX}-${userId}`
    const legacyUser = localStorage.getItem(legacyUserKey)
    if (legacyUser) {
      const parsed = parseCountries(legacyUser)
      if (parsed.length > 0) {
        localStorage.setItem(userKey, JSON.stringify(parsed))
        localStorage.removeItem(legacyUserKey)
        return parsed
      }
    }

    const legacyPreAuth = parseCountries(localStorage.getItem(LEGACY_STORAGE_KEY_PREFIX))
    if (legacyPreAuth.length > 0) {
      localStorage.setItem(userKey, JSON.stringify(legacyPreAuth))
      localStorage.removeItem(LEGACY_STORAGE_KEY_PREFIX)
      return legacyPreAuth
    }

    return []
  } catch {
    return []
  }
}

interface AppProps {
  countriesClient?: CountriesClient
}

function App({ countriesClient = httpCountriesClient }: AppProps) {
  const { data: session, isPending } = useSession()
  const [visitedCountries, setVisitedCountries] = useState<VisitedCountry[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [sessionCheckTimedOut, setSessionCheckTimedOut] = useState(false)
  const [activeView, setActiveView] = useState<'map' | 'timeline'>('map')
  const [journalCountry, setJournalCountry] = useState<VisitedCountry | null>(null)

  const refetchFromServer = async () => {
    try {
      const latest = await countriesClient.list()
      setVisitedCountries(latest)
    } catch (err) {
      console.warn('Failed to refresh countries:', err)
    }
  }

  const updateCountryJournal = async (
    country: VisitedCountry,
    updates: CountryJournalUpdates
  ): Promise<void> => {
    const { notes, visitedAt, rating, tags } = updates
    setVisitedCountries(prev =>
      prev.map(v =>
        sameCountry(v, country)
          ? { ...v, notes, visitedAt: visitedAt || undefined, rating, tags }
          : v
      )
    )
    try {
      await countriesClient.updateJournal(country, updates)
    } catch (err) {
      console.warn('Failed to update journal:', err)
      await refetchFromServer()
    }
  }

  const openJournal = (code: string, name: string) => {
    const country = findCountry(visitedCountries, { code, name })
    if (country) setJournalCountry(country)
  }

  // Load visited countries when user session is available
  useEffect(() => {
    if (session?.user?.id) {
      let cancelled = false
      const load = async () => {
        let fromDb: VisitedCountry[]
        try {
          fromDb = await countriesClient.list()
        } catch (err) {
          console.warn('Failed to load countries:', err)
          if (!cancelled) {
            setVisitedCountries(loadVisitedCountries(session.user.id))
          }
          return
        }
        if (cancelled) return

        // One-time migration: if DB is empty, migrate existing localStorage for this user.
        if (fromDb.length === 0) {
          const legacy = loadVisitedCountries(session.user.id)
          if (legacy.length > 0) {
            try {
              for (const c of legacy) {
                await countriesClient.add(c)
              }

              // Clear local-only data after successful migration.
              localStorage.removeItem(
                `${STORAGE_KEY_PREFIX}-${session.user.id}`
              )

              const refreshed = await countriesClient.list()
              if (cancelled) return
              setVisitedCountries(refreshed.length > 0 ? refreshed : legacy)
              return
            } catch {
              // Fall back to legacy data in UI if migration fails.
              setVisitedCountries(legacy)
              return
            }
          }
        }

        setVisitedCountries(fromDb)
      }

      load()

      return () => {
        cancelled = true
      }
    }
  }, [countriesClient, session?.user?.id])

  const toggleCountry = (country: VisitedCountry | Country, explicitStatus?: 'visited' | 'bucketlist') => {
    setVisitedCountries(prev => {
      const existing = findCountry(prev, country)

      let next: VisitedCountry[]
      let serverAction: 'insert' | 'delete'
      let newStatus: 'visited' | 'bucketlist' = 'visited'

      if (explicitStatus !== undefined) {
        // Search-triggered: explicit status provided
        if (existing && existing.status === explicitStatus) {
          // Already that exact status — remove
          next = prev.filter(v => !sameCountry(v, country))
          serverAction = 'delete'
        } else if (existing) {
          // Exists with different status — update in place
          newStatus = explicitStatus
          next = prev.map(v =>
            sameCountry(v, country)
              ? { ...v, status: explicitStatus }
              : v
          )
          serverAction = 'insert'
        } else {
          // Not in list — add
          newStatus = explicitStatus
          next = [...prev, { code: country.code, name: country.name, status: explicitStatus }]
          serverAction = 'insert'
        }
      } else {
        // Map click cycle: not present → visited → bucketlist → remove
        if (!existing) {
          newStatus = 'visited'
          next = [...prev, { code: country.code, name: country.name, status: 'visited' }]
          serverAction = 'insert'
        } else if (existing.status === 'visited') {
          newStatus = 'bucketlist'
          next = prev.map(v =>
            sameCountry(v, country)
              ? { ...v, status: 'bucketlist' }
              : v
          )
          serverAction = 'insert'
        } else {
          // bucketlist → remove
          next = prev.filter(v => !sameCountry(v, country))
          serverAction = 'delete'
        }
      }

      void (async () => {
        try {
          if (serverAction === 'delete') {
            await countriesClient.remove(country)
          } else {
            await countriesClient.add({ code: country.code, name: country.name, status: newStatus })
          }
        } catch (err) {
          console.warn('Failed to persist visited country:', err)
          await refetchFromServer()
        }
      })()

      return next
    })
  }

  const removeCountry = (country: VisitedCountry) => {
    setVisitedCountries(prev => prev.filter(v => !sameCountry(v, country)))
    void countriesClient.remove(country).catch(async (err) => {
      console.warn('Failed to remove country:', err)
      await refetchFromServer()
    })
  }

  const resetVisitedCountries = async () => {
    setVisitedCountries([])
    try {
      await countriesClient.reset()
    } catch (err) {
      console.warn('Failed to reset visited countries:', err)
      await refetchFromServer()
    }
  }

  useEffect(() => {
    if (!isPending) {
      setSessionCheckTimedOut(false)
      return
    }
    // Vercel cold start + Neon compute wake-up can take 10-15s on free tier
    const timeoutId = window.setTimeout(() => {
      setSessionCheckTimedOut(true)
    }, 20000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isPending])

  // Show loading state while checking authentication
  if (isPending && !sessionCheckTimedOut) {
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
          {sessionCheckTimedOut && (
            <div className="w-full max-w-md mb-4 p-3 bg-amber-100 border border-amber-300 text-amber-800 rounded">
              Session check timed out. The auth server may be unavailable.
            </div>
          )}
          <AuthForm />
        </div>
        <Footer />
      </div>
    )
  }

  // Show main app if logged in
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {journalCountry && (
        <CountryDetailModal
          country={journalCountry}
          onSave={(updates) => { void updateCountryJournal(journalCountry, updates); setJournalCountry(null) }}
          onClose={() => setJournalCountry(null)}
        />
      )}
      <Header user={{ name: session.user.name, email: session.user.email }} />

      <Stats
        visitedCount={withStatus(visitedCountries, 'visited').length}
        bucketListCount={withStatus(visitedCountries, 'bucketlist').length}
      />

      {/* View toggle + search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 container mx-auto max-w-6xl">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm shrink-0">
          <button
            type="button"
            onClick={() => setActiveView('map')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeView === 'map'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => setActiveView('timeline')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeView === 'timeline'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Timeline
          </button>
        </div>

        {activeView === 'map' && (
          <CountrySearch
            countries={countries}
            visitedCountries={visitedCountries}
            onCountrySelect={toggleCountry}
          />
        )}
      </div>

      {activeView === 'map' ? (
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <WorldMap
                visitedCountries={visitedCountries}
                onCountryAction={(code, name, status) => toggleCountry({ code, name }, status)}
                onCountriesLoaded={setCountries}
                onOpenJournal={openJournal}
              />
            </div>
            <div className="h-[420px] max-h-[420px] mb-4">
              <VisitedCountriesList
                visitedCountries={visitedCountries}
                onRemove={removeCountry}
                onReset={resetVisitedCountries}
                onEditJournal={setJournalCountry}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="container mx-auto max-w-6xl">
          <TripTimeline visitedCountries={visitedCountries} />
        </div>
      )}
      <Footer />
    </div>
  )
}

export default App
