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
import ErrorToast from './components/ErrorToast'
import ToastStack from './components/ToastStack'
import MobileBackButton from './components/MobileBackButton'
import { detectMilestone, markMilestoneSeen, milestoneMessage, seenMilestones, type Milestone } from './lib/milestones'
import { journalValuesOf } from './lib/journal'
import { isPendingVisit, visitValuesOf } from './lib/countryVisits'
import { useVisitActions } from './lib/useVisitActions'
import AtlasLoadError from './components/AtlasLoadError'
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
  // Which marked countries the map colours in: the desktop "Show" legend and the mobile Map filters popover.
  const [mapFilter, setMapFilter] = useState<MapFilter>(SHOW_ALL)
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  // Whose countries have finished loading; until it is this user's, the list is loading.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  // Whose load failed (shown as an error over the map, never as an empty atlas); bump loadAttempt to retry.
  const [loadFailedFor, setLoadFailedFor] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [mapFocus, setMapFocus] = useState<{ country: Country; seq: number; pulse?: boolean } | null>(null)
  const [milestone, setMilestone] = useState<Milestone | null>(null)
  const dismissMilestone = useCallback(() => setMilestone(null), [])
  const [selected, setSelected] = useState<Country | null>(null)
  const [removed, setRemoved] = useState<VisitedCountry | null>(null)
  // The last mark, for its Undo toast: what the country was before.
  const [marked, setMarked] = useState<{ country: CountryIdentity; previous?: VisitedCountry['status']; status: VisitedCountry['status'] } | null>(null)
  // A failed mark / remove, reverted by the refetch, with a way to try again.
  const [saveError, setSaveError] = useState<{ message: string; retry: () => void } | null>(null)
  const dismissSaveError = useCallback(() => setSaveError(null), [])
  // Derived: a marked selection opens its detail; an unmarked one (clicked on the map) its mark panel.
  const selectedCountry = selected ? findCountry(visitedCountries, selected) ?? null : null
  const pickedCountry = selected && !selectedCountry ? selected : null
  const loadingCountries = Boolean(session?.user?.id) && loadedFor !== session?.user?.id
  const loadFailed = Boolean(session?.user?.id) && loadFailedFor === session?.user?.id

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

  // Extra visits (FEATURES.md #8): failures show in the ErrorToast; a removal has Undo.
  const visitActions = useVisitActions({
    client: countriesClient,
    visitedCountries,
    setVisitedCountries,
    refresh: refreshCountries,
    reportError: setSaveError,
  })
  const { removedVisit, dismissRemovedVisit } = visitActions

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
          // Not the local copy: an empty or stale fallback would look like lost data.
          console.warn('Failed to load countries:', err)
          if (!cancelled) {
            setVisitedCountries([])
            setLoadFailedFor(session.user.id)
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
  }, [countriesClient, session?.user?.id, loadAttempt])

  const retryLoad = () => {
    setLoadFailedFor(null)
    setLoadedFor(null)
    setLoadAttempt(n => n + 1)
  }

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
      dismissRemovedVisit()
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
          // The mark is undone, so its Undo and any celebration go too.
          setMarked(prev => (prev && sameCountry(prev.country, country) ? null : prev))
          if (celebrated) setMilestone(null)
          setSaveError({
            message: `Couldn't save ${country.name}. Undone.`,
            retry: () => { setSaveError(null); toggleCountry(country, explicitStatus) },
          })
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
    dismissRemovedVisit() // its visits go with it
    setRemoved(country)
    if (selected && sameCountry(selected, country)) setSelected(null)
    setVisitedCountries(prev => prev.filter(v => !sameCountry(v, country)))
    // Kept so Undo can wait for it: a slow DELETE landing after the restore
    // would otherwise wipe the restored row.
    pendingRemoval.current = countriesClient.remove(country).catch(async (err) => {
      console.warn('Failed to remove country:', err)
      setRemoved(prev => (prev && sameCountry(prev, country) ? null : prev))
      await refreshCountries()
      setSaveError({
        message: `Couldn't remove ${country.name}. Undone.`,
        retry: () => { setSaveError(null); removeCountry(country) },
      })
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
    // Nothing from before the reset may be undone into the empty atlas.
    setRemoved(null)
    setMarked(null)
    dismissRemovedVisit()
    setMilestone(null)
    setSaveError(null)
    setSelected(null)
    setVisitedCountries([])
    try {
      // A mark or removal still in flight would otherwise land after the reset.
      await Promise.allSettled([pendingMark.current, pendingRemoval.current, visitActions.settled()])
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
  const showWelcome = desktop && !loadingCountries && !loadFailed && !welcomeDismissed && visitedCountries.length === 0 && !selected

  // Signed in: app bar, then the map with the country panel, or the timeline.
  return (
    <div className="min-h-[100dvh] lg:h-[100dvh] flex flex-col bg-[#DCE6EE] text-[#1E293B]">
      {/* Lowest first: the latest undo, a failed save, then a milestone. */}
      <ToastStack>
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
        {removedVisit && (
          <Toast
            message={`Removed a visit to ${removedVisit.country.name}`}
            action={{ label: 'Undo', onClick: () => { void visitActions.undoRemoveVisit() } }}
            onDismiss={dismissRemovedVisit}
          />
        )}
        {saveError && <ErrorToast message={saveError.message} onRetry={saveError.retry} onDismiss={dismissSaveError} />}
        {milestone && <Toast message={milestoneMessage(milestone)} tone="celebrate" onDismiss={dismissMilestone} />}
      </ToastStack>
      {showBar && (
        <AppBar
          view={activeView}
          onViewChange={setActiveView}
          search={activeView === 'map' && search(false)}
          account={<UserMenu user={user} />}
        />
      )}

      {activeView === 'map' ? (
        // Below lg the map fills the screen and the country sheet overlays it.
        <main className="relative h-[100dvh] overflow-hidden lg:h-auto lg:overflow-visible flex-1 min-h-0 flex flex-col lg:flex-row">
          <section aria-label="World map" className="absolute inset-0 lg:relative lg:inset-auto lg:h-auto lg:min-h-0 lg:flex-1 min-w-0">
            <WorldMap
              visitedCountries={visitedCountries}
              onCountriesLoaded={setCountries}
              onSelectCountry={setSelected}
              selected={selected}
              onWorldView={() => setSelected(null)}
              loading={loadingCountries}
              quiet={Boolean(removed || removedVisit || marked || milestone)}
              welcome={showWelcome && <MapWelcomeCard search={search(false, true)} onDismiss={() => setWelcomeDismissed(true)} />}
              focus={mapFocus}
              mapFilter={mapFilter}
              onMapFilterChange={setMapFilter}
            />
            {loadFailed && <AtlasLoadError onRetry={retryLoad} />}
            {!desktop && (
              // A selected country swaps the avatar for a back button before the search.
              <div className="absolute top-4 inset-x-4 z-20 flex gap-2">
                {selected && <MobileBackButton onClick={() => setSelected(null)} />}
                <div className="flex-1 min-w-0">{search(true)}</div>
                {!selected && <UserMenu user={user} floating />}
              </div>
            )}
          </section>
          {/* CountrySidebar renders the <aside> landmark on desktop, or its own MobileSheet below lg. */}
          <div className="lg:relative lg:z-10 lg:w-[360px] lg:shrink-0 lg:bg-white">
            <CountrySidebar
              visitedCountries={visitedCountries}
              selected={selectedCountry}
              picked={pickedCountry}
              onMark={(country, status) => toggleCountry(country, status)}
              loading={loadingCountries}
              loadFailed={loadFailed}
              onSelect={selectCountry}
              onBack={() => setSelected(null)}
              onSetStatus={(country, status) => toggleCountry(country, status)}
              onSaveJournal={updateCountryJournal}
              onRemove={removeCountry}
              onAddVisit={(country, values) => { void visitActions.addVisit(country, values) }}
              onUpdateVisit={(id, values) => { void visitActions.updateVisit(id, values) }}
              onRemoveVisit={visitActions.removeVisit}
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
