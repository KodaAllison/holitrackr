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

function App() {
  const { data: session, isPending } = useSession()
  const [visitedCountries, setVisitedCountries] = useState<VisitedCountry[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [sessionCheckTimedOut, setSessionCheckTimedOut] = useState(false)

  const fetchVisitedCountries = async (): Promise<VisitedCountry[]> => {
    try {
      const resp = await fetch('/api/countries', {
        method: 'GET',
        credentials: 'include',
      })
      if (!resp.ok) return []
      const data = (await resp.json()) as unknown
      if (!Array.isArray(data)) return []
      const isRawCountry = (c: unknown): c is Record<string, unknown> => {
        if (typeof c !== 'object' || c === null) return false
        const obj = c as Record<string, unknown>
        return typeof obj.code === 'string' && typeof obj.name === 'string'
      }
      return data.filter(isRawCountry).map((c): VisitedCountry => ({
        code: c.code as string,
        name: c.name as string,
        status:
          c.status === 'visited' || c.status === 'bucketlist'
            ? c.status
            : 'visited',
        notes: typeof c.notes === 'string' ? c.notes : undefined,
        visitedAt: typeof c.visitedAt === 'string' ? c.visitedAt : undefined,
      }))
    } catch {
      return []
    }
  }

  const insertVisitedCountry = async (country: VisitedCountry): Promise<void> => {
    await fetch('/api/countries', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(country),
    })
  }

  const deleteVisitedCountry = async (country: VisitedCountry): Promise<void> => {
    await fetch('/api/countries', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(country),
    })
  }

  const resetVisitedCountriesOnServer = async (): Promise<void> => {
    await fetch('/api/countries?reset=true', {
      method: 'DELETE',
      credentials: 'include',
    })
  }

  const refetchFromServer = async () => {
    const latest = await fetchVisitedCountries()
    setVisitedCountries(latest)
  }

  const updateCountryJournal = async (country: VisitedCountry, notes: string, visitedAt: string): Promise<void> => {
    setVisitedCountries(prev =>
      prev.map(v =>
        v.code === country.code && v.name === country.name ? { ...v, notes, visitedAt: visitedAt || undefined } : v
      )
    )
    try {
      const resp = await fetch('/api/countries', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: country.code, name: country.name, notes, visitedAt: visitedAt || null }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    } catch (err) {
      console.warn('Failed to update journal:', err)
      await refetchFromServer()
    }
  }

  // Load visited countries when user session is available
  useEffect(() => {
    if (session?.user?.id) {
      let cancelled = false
      const load = async () => {
        const fromDb = await fetchVisitedCountries()
        if (cancelled) return

        // One-time migration: if DB is empty, migrate existing localStorage for this user.
        if (fromDb.length === 0) {
          const legacy = loadVisitedCountries(session.user.id)
          if (legacy.length > 0) {
            try {
              for (const c of legacy) {
                await insertVisitedCountry(c)
              }

              // Clear local-only data after successful migration.
              localStorage.removeItem(
                `${STORAGE_KEY_PREFIX}-${session.user.id}`
              )

              const refreshed = await fetchVisitedCountries()
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
  }, [session?.user?.id])

  const toggleCountry = (country: VisitedCountry | Country, explicitStatus?: 'visited' | 'bucketlist') => {
    setVisitedCountries(prev => {
      const existing = prev.find(
        v => v.code === country.code && v.name === country.name
      )

      let next: VisitedCountry[]
      let serverAction: 'insert' | 'delete'
      let newStatus: 'visited' | 'bucketlist' = 'visited'

      if (explicitStatus !== undefined) {
        // Search-triggered: explicit status provided
        if (existing && existing.status === explicitStatus) {
          // Already that exact status — remove
          next = prev.filter(v => !(v.code === country.code && v.name === country.name))
          serverAction = 'delete'
        } else if (existing) {
          // Exists with different status — update in place
          newStatus = explicitStatus
          next = prev.map(v =>
            v.code === country.code && v.name === country.name
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
            v.code === country.code && v.name === country.name
              ? { ...v, status: 'bucketlist' }
              : v
          )
          serverAction = 'insert'
        } else {
          // bucketlist → remove
          next = prev.filter(v => !(v.code === country.code && v.name === country.name))
          serverAction = 'delete'
        }
      }

      void (async () => {
        try {
          if (serverAction === 'delete') {
            await deleteVisitedCountry({ code: country.code, name: country.name, status: existing?.status ?? 'visited' })
          } else {
            await insertVisitedCountry({ code: country.code, name: country.name, status: newStatus })
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
    setVisitedCountries(prev => prev.filter(v => !(v.code === country.code && v.name === country.name)))
    void deleteVisitedCountry(country)
  }

  const resetVisitedCountries = async () => {
    setVisitedCountries([])
    try {
      await resetVisitedCountriesOnServer()
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
      <Header />
      
      {/* User Menu */}
      <div className="flex justify-end px-4 py-3">
        <UserMenu user={{ name: session.user.name, email: session.user.email }} />
      </div>

      <Stats
        visitedCount={visitedCountries.filter(v => v.status === 'visited').length}
        bucketListCount={visitedCountries.filter(v => v.status === 'bucketlist').length}
      />
      
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
              onCountryAction={(code, name, status) => toggleCountry({ code, name }, status)}
              onCountriesLoaded={setCountries}
            />
          </div>
          <div className="h-[420px] max-h-[420px] mb-4">
            <VisitedCountriesList
              visitedCountries={visitedCountries}
              onRemove={removeCountry}
              onReset={resetVisitedCountries}
              onUpdateJournal={updateCountryJournal}
            />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default App
