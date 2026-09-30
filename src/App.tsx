import { useCallback, useRef, useState, useEffect } from 'react'
import type { Country, MapFilter, VisitedCountry } from './types'
import WorldMap from './components/WorldMap'
import AppBar from './components/AppBar'
import type { AppView } from './components/ViewSwitch'
import UserMenu from './components/UserMenu'
import LoadingScreen from './components/LoadingScreen'
import TimelineButton from './components/TimelineButton'
import CountrySearch from './components/CountrySearch'
import CountrySidebar from './components/CountrySidebar'
import Toast from './components/Toast'
import { detectMilestone, markMilestoneSeen, milestoneMessage, seenMilestones, type Milestone } from './lib/milestones'
import { journalValuesOf, type JournalValues } from './lib/journal'
import { isPendingVisit, toVisit, visitValuesOf, withVisitAdded, withVisitRemoved, withVisitReplaced } from './lib/countryVisits'
import TripTimeline from './components/TripTimeline'
import MapWelcomeCard from './components/MapWelcomeCard'
import { markedMessage, SHOW_ALL } from './lib/mapFilter'
import SignInScreen from './components/SignInScreen'
import { useSession } from './lib/auth-client'
import { useMediaQuery } from './lib/useMediaQuery'
import {
  httpCountriesClient,
  type CountriesClient,
  type CountryJournalUpdates,
} from './lib/countriesClient'
import { sameCountry, findCountry, nextVisitedState, statusOf, type CountryIdentity } from './lib/visitedCountries'

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
  const [activeView, setActiveView] = useState<AppView>('map')
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [mapFilter, setMapFilter] = useState<MapFilter>(SHOW_ALL)
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  // Whose countries have finished loading; until it is this user's, the list is loading.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [mapFocus, setMapFocus] = useState<{ country: Country; seq: number; pulse?: boolean } | null>(null)
  const [milestone, setMilestone] = useState<Milestone | null>(null)
  const dismissMilestone = useCallback(() => setMilestone(null), [])
  const [selected, setSelected] = useState<Country | null>(null)
  const [removed, setRemoved] = useState<VisitedCountry | null>(null)
  // The last mark, for its Undo toast: what the country was before.
  const [marked, setMarked] = useState<{ country: CountryIdentity; previous?: VisitedCountry['status']; status: VisitedCountry['status'] } | null>(null)
  // Derived: a marked selection opens its detail; an unmarked one (clicked on the map) its mark panel.
  const selectedCountry = selected ? findCountry(visitedCountries, selected) ?? null : null
  const pickedCountry = selected && !selectedCountry ? selected : null
  const loadingCountries = Boolean(session?.user?.id) && loadedFor !== session?.user?.id

  const dismissUndo = useCallback(() => setRemoved(null), [])
  const dismissMarked = useCallback(() => setMarked(null), [])
  const pendingRemoval = useRef<Promise<void>>(Promise.resolve())
  const pendingMark = useRef<Promise<void>>(Promise.resolve())
  const focusMap = (country: Country) => setMapFocus(prev => ({ country, seq: (prev?.seq ?? 0) + 1 }))
  const selectCountry = (country: Country) => {
    setSelected(country)
    focusMap(country)
  }

  const refreshCountries = async () => {
    try {
      const latest = await countriesClient.list()
      setVisitedCountries(latest)
    } catch (err) {
      console.warn('Failed to refresh countries:', err)
    }
  }

  /** Optimistic journal save. Rejects on failure (after re-syncing) so callers can say so. */
  const updateCountryJournal = async (
    country: VisitedCountry,
    updates: CountryJournalUpdates
  ): Promise<void> => {
    const { notes, place, visitedAt, rating, tags } = updates
    const apply = (v: VisitedCountry): VisitedCountry =>
      ({ ...v, notes, place: place.trim() || undefined, visitedAt: visitedAt || undefined, rating, tags })
    setVisitedCountries(prev => prev.map(v => (sameCountry(v, country) ? apply(v) : v)))
    // An edit flushed as the panel closes on Remove must survive an Undo.
    setRemoved(prev => (prev && sameCountry(prev, country) ? apply(prev) : prev))
    try {
      await countriesClient.updateJournal(country, updates)
    } catch (err) {
      console.warn('Failed to update journal:', err)
      await refreshCountries()
      throw err
    }
  }

  // Extra visits (FEATURES.md #8). A new visit shows at once under a
  // placeholder id (negative, see isPendingVisit) until the server returns it.
  const nextPendingVisitId = useRef(-1)
  const addVisit = async (country: VisitedCountry, values: JournalValues): Promise<void> => {
    const pendingId = nextPendingVisitId.current--
    setVisitedCountries(prev => withVisitAdded(prev, country, toVisit(pendingId, values)))
    try {
      const stored = await countriesClient.addVisit(country, values)
      setVisitedCountries(prev => withVisitReplaced(prev, pendingId, stored))
    } catch (err) {
      console.warn('Failed to add visit:', err)
      await refreshCountries()
    }
  }

  const updateVisit = async (id: number, values: JournalValues): Promise<void> => {
    if (isPendingVisit(id)) return // not stored yet; the list disables editing it
    setVisitedCountries(prev => withVisitReplaced(prev, id, toVisit(id, values)))
    try {
      await countriesClient.updateVisit(id, values)
    } catch (err) {
      console.warn('Failed to update visit:', err)
      await refreshCountries()
    }
  }

  const removeVisit = async (id: number): Promise<void> => {
    if (isPendingVisit(id)) return // still saving; the list hides Remove until it is stored
    setVisitedCountries(prev => withVisitRemoved(prev, id))
    try {
      await countriesClient.removeVisit(id)
    } catch (err) {
      console.warn('Failed to remove visit:', err)
      await refreshCountries()
    }
  }

  // From the timeline ("Add a date"): back to the map with the country open.
  const openInMap = (country: VisitedCountry) => {
    setActiveView('map')
    selectCountry(country)
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

      const userId = session.user.id
      void load().finally(() => { if (!cancelled) setLoadedFor(userId) })

      return () => {
        cancelled = true
      }
    }
  }, [countriesClient, session?.user?.id])

  /** Returns true when the change reached a milestone (which also focuses the map). */
  const toggleCountry = (country: VisitedCountry | Country, explicitStatus?: 'visited' | 'bucketlist'): boolean => {
    // Milestone moments: celebrate once per milestone, per user.
    const userId = session?.user?.id
    const { next: after, action: planned } = nextVisitedState(visitedCountries, country, explicitStatus)
    const reached = detectMilestone(visitedCountries, after, country)
    let celebrated = false
    if (userId && reached && !seenMilestones(userId).has(reached.id)) {
      celebrated = true
      markMilestoneSeen(userId, reached.id)
      setMilestone(reached)
      setMapFocus(prev => ({ country, seq: (prev?.seq ?? 0) + 1, pulse: true }))
    }
    if (planned.type === 'upsert') {
      setRemoved(null)
      setMarked({ country: { code: country.code, name: country.name }, previous: statusOf(visitedCountries, country), status: planned.status })
    }
    setVisitedCountries(prev => {
      const { next, action } = nextVisitedState(prev, country, explicitStatus)

      // Kept so Undo can wait for it.
      pendingMark.current = (async () => {
        try {
          if (action.type === 'remove') {
            await countriesClient.remove(country)
          } else {
            await countriesClient.add({ code: country.code, name: country.name, status: action.status })
          }
        } catch (err) {
          console.warn('Failed to persist visited country:', err)
          await refreshCountries()
        }
      })()

      return next
    })
    return celebrated
  }

  // Undo a mark: back to the previous status, or unmarked.
  const undoMark = async () => {
    const mark = marked
    if (!mark) return
    setMarked(null)
    const { country, previous } = mark
    setVisitedCountries(prev => previous
      ? prev.map(v => (sameCountry(v, country) ? { ...v, status: previous } : v))
      : prev.filter(v => !sameCountry(v, country)))
    try {
      await pendingMark.current
      if (previous) await countriesClient.add({ code: country.code, name: country.name, status: previous })
      else await countriesClient.remove(country)
    } catch (err) {
      console.warn('Failed to undo mark:', err)
      await refreshCountries()
    }
  }

  const removeCountry = (country: VisitedCountry) => {
    setMarked(null)
    setRemoved(country)
    if (selected && sameCountry(selected, country)) setSelected(null)
    setVisitedCountries(prev => prev.filter(v => !sameCountry(v, country)))
    // Kept so Undo can wait for it: a slow DELETE landing after the restore
    // would otherwise wipe the restored row.
    pendingRemoval.current = countriesClient.remove(country).catch(async (err) => {
      console.warn('Failed to remove country:', err)
      await refreshCountries()
    })
  }

  // Undo a removal: put the row back, then restore it (and its journal) on the server.
  const undoRemove = async () => {
    const country = removed
    if (!country) return
    setRemoved(null)
    setVisitedCountries(prev => (findCountry(prev, country) ? prev : [...prev, country]))
    try {
      await pendingRemoval.current
      await countriesClient.add({ code: country.code, name: country.name, status: country.status, notes: country.notes })
      await countriesClient.updateJournal(country, journalValuesOf(country))
      // Removing deleted the extra visits too; add them back (they get new ids).
      const visits = (country.visits ?? []).filter(v => !isPendingVisit(v.id))
      for (const visit of visits) {
        await countriesClient.addVisit(country, visitValuesOf(visit))
      }
      if (visits.length > 0) await refreshCountries()
    } catch (err) {
      console.warn('Failed to undo removal:', err)
      await refreshCountries()
    }
  }

  const resetVisitedCountries = async () => {
    setVisitedCountries([])
    try {
      await countriesClient.reset()
    } catch (err) {
      console.warn('Failed to reset visited countries:', err)
      await refreshCountries()
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
  if (isPending && !sessionCheckTimedOut) return <LoadingScreen />

  // Signed out: the atlas-plate sign-in screen
  if (!session) {
    return <SignInScreen timedOut={sessionCheckTimedOut} />
  }

  const user = { name: session.user.name, email: session.user.email }
  const search = (floating: boolean, welcome?: boolean) => (
    <CountrySearch
      floating={floating}
      welcome={welcome}
      loading={loadingCountries}
      countries={countries}
      visitedCountries={visitedCountries}
      onCountrySelect={(country, status) => {
        if (!toggleCountry(country, status)) focusMap(country)
      }}
    />
  )
  // Mobile map view has no bar: search and account float over the map instead.
  const showBar = desktop || activeView === 'timeline'
  // First run (desktop): the welcome card over the map until something is marked or it is dismissed.
  const showWelcome = desktop && !loadingCountries && !welcomeDismissed && visitedCountries.length === 0 && !selected

  // Signed in: app bar, then the map with the country panel, or the timeline.
  return (
    <div className="min-h-[100dvh] lg:h-[100dvh] flex flex-col bg-[#DCE6EE] text-[#1E293B]">
      {marked && (
        <Toast
          message={markedMessage(marked.country.name, marked.status)}
          action={{ label: 'Undo', onClick: () => { void undoMark() } }}
          onDismiss={dismissMarked}
        />
      )}
      {removed && (
        <Toast message={`Removed ${removed.name}`} action={{ label: 'Undo', onClick: () => { void undoRemove() } }} onDismiss={dismissUndo} />
      )}
      {milestone && (
        <Toast message={milestoneMessage(milestone)} tone="celebrate" offset={removed || marked ? 1 : 0} onDismiss={dismissMilestone} />
      )}
      {showBar && (
        <AppBar
          view={activeView}
          onViewChange={setActiveView}
          search={activeView === 'map' && search(false)}
          account={<UserMenu user={user} />}
        />
      )}

      {activeView === 'map' ? (
        <main className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <section aria-label="World map" className="relative h-[62dvh] min-h-[360px] lg:h-auto lg:min-h-0 lg:flex-1 min-w-0">
            <WorldMap
              visitedCountries={visitedCountries}
              onCountriesLoaded={setCountries}
              onSelectCountry={setSelected}
              selected={selected}
              onWorldView={() => setSelected(null)}
              filter={mapFilter}
              onFilterChange={setMapFilter}
              loading={loadingCountries}
              quiet={Boolean(removed || marked || milestone)}
              welcome={showWelcome && <MapWelcomeCard search={search(false, true)} onDismiss={() => setWelcomeDismissed(true)} />}
              focus={mapFocus}
            />
            {!desktop && (
              <div className="absolute top-4 inset-x-4 z-20 flex gap-2">
                <div className="flex-1 min-w-0">{search(true)}</div>
                <UserMenu user={user} floating />
              </div>
            )}
          </section>
          {/* CountrySidebar renders the <aside> landmark and, on desktop, its left border. */}
          <div className="relative z-10 -mt-5 pt-2 rounded-t-[20px] bg-white shadow-[0_-8px_30px_rgba(15,23,42,0.16)] lg:mt-0 lg:pt-0 lg:w-[360px] lg:shrink-0 lg:rounded-none lg:shadow-none">
            <div aria-hidden="true" className="lg:hidden mx-auto h-[5px] w-10 rounded-full bg-[#C7D0D9]" />
            <CountrySidebar
              visitedCountries={visitedCountries}
              selected={selectedCountry}
              picked={pickedCountry}
              onMark={(country, status) => toggleCountry(country, status)}
              loading={loadingCountries}
              onSelect={selectCountry}
              onBack={() => setSelected(null)}
              onSetStatus={(country, status) => toggleCountry(country, status)}
              onSaveJournal={updateCountryJournal}
              onRemove={removeCountry}
              onAddVisit={(country, values) => { void addVisit(country, values) }}
              onUpdateVisit={(id, values) => { void updateVisit(id, values) }}
              onRemoveVisit={id => { void removeVisit(id) }}
              onReset={resetVisitedCountries}
              listAction={!desktop && <TimelineButton onClick={() => { setActiveView('timeline'); window.scrollTo(0, 0) }} />}
            />
          </div>
        </main>
      ) : (
        // Full-bleed: TripTimeline fills this height (definite on lg) and scrolls its own feed.
        <main className="flex-1 min-h-0 bg-[#F8FAFC] lg:overflow-hidden">
          <TripTimeline visitedCountries={visitedCountries} onOpenJournal={openInMap} />
        </main>
      )}
    </div>
  )
}

export default App
