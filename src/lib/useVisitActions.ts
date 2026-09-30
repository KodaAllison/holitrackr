import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { CountryVisit, VisitedCountry } from '../types'
import type { CountriesClient } from './countriesClient'
import { isPendingVisit, toVisit, visitValuesOf, withVisitAdded, withVisitRemoved, withVisitReplaced } from './countryVisits'
import type { JournalValues } from './journal'

export interface SaveErrorReport {
  message: string
  retry: () => void
}

interface VisitActionsOptions {
  client: CountriesClient
  visitedCountries: VisitedCountry[]
  setVisitedCountries: Dispatch<SetStateAction<VisitedCountry[]>>
  /** Re-sync from the server (drops whatever the failed change did). */
  refresh: () => Promise<void>
  /** Show a failed save, e.g. in the ErrorToast, with a way to retry. */
  reportError: (error: SaveErrorReport | null) => void
}

export interface RemovedVisit {
  country: VisitedCountry
  visit: CountryVisit
}

/**
 * Extra visits (FEATURES.md #8): optimistic add, edit and remove, each
 * reporting a failure (with Retry) instead of just re-syncing, and an Undo
 * for the last removal. A new visit shows at once under a placeholder id
 * (negative, see isPendingVisit) until the server returns it.
 */
export function useVisitActions({ client, visitedCountries, setVisitedCountries, refresh, reportError }: VisitActionsOptions) {
  const nextPendingId = useRef(-1)
  const [removedVisit, setRemovedVisit] = useState<RemovedVisit | null>(null)
  // Kept so Undo can wait for it: a DELETE landing after the restore is harmless
  // (the restored visit has a new id), but the order keeps the server tidy.
  const pendingRemoval = useRef<Promise<void>>(Promise.resolve())
  // Stable: the Undo toast restarts its timer when onDismiss changes.
  const dismissRemovedVisit = useCallback(() => setRemovedVisit(null), [])

  const failed = async (err: unknown, message: string, retry: () => void) => {
    console.warn(message, err)
    await refresh()
    reportError({ message, retry: () => { reportError(null); retry() } })
  }

  const addVisit = async (country: VisitedCountry, values: JournalValues): Promise<void> => {
    const pendingId = nextPendingId.current--
    setVisitedCountries(prev => withVisitAdded(prev, country, toVisit(pendingId, values)))
    try {
      const stored = await client.addVisit(country, values)
      setVisitedCountries(prev => withVisitReplaced(prev, pendingId, stored))
    } catch (err) {
      await failed(err, `Couldn't save your visit to ${country.name}.`, () => { void addVisit(country, values) })
    }
  }

  const updateVisit = async (id: number, values: JournalValues): Promise<void> => {
    if (isPendingVisit(id)) return // not stored yet; the list disables editing it
    const country = visitedCountries.find(c => c.visits?.some(v => v.id === id))
    setVisitedCountries(prev => withVisitReplaced(prev, id, toVisit(id, values)))
    try {
      await client.updateVisit(id, values)
    } catch (err) {
      const name = country ? ` to ${country.name}` : ''
      await failed(err, `Couldn't save your visit${name}.`, () => { void updateVisit(id, values) })
    }
  }

  const removeVisit = (id: number): void => {
    if (isPendingVisit(id)) return // still saving; the list hides Remove until it is stored
    const country = visitedCountries.find(c => c.visits?.some(v => v.id === id))
    const visit = country?.visits?.find(v => v.id === id)
    if (country && visit) setRemovedVisit({ country, visit })
    setVisitedCountries(prev => withVisitRemoved(prev, id))
    pendingRemoval.current = client.removeVisit(id).catch(async err => {
      setRemovedVisit(prev => (prev?.visit.id === id ? null : prev))
      const name = country ? ` to ${country.name}` : ''
      await failed(err, `Couldn't remove your visit${name}. Undone.`, () => removeVisit(id))
    })
  }

  // Undo a visit's removal: show it again at once, then add it back (it gets a new id).
  const undoRemoveVisit = async (): Promise<void> => {
    const removed = removedVisit
    if (!removed) return
    setRemovedVisit(null)
    const { country, visit } = removed
    const values = visitValuesOf(visit)
    const pendingId = nextPendingId.current--
    setVisitedCountries(prev => withVisitAdded(prev, country, toVisit(pendingId, values)))
    try {
      await pendingRemoval.current
      const stored = await client.addVisit(country, values)
      setVisitedCountries(prev => withVisitReplaced(prev, pendingId, stored))
    } catch (err) {
      await failed(err, `Couldn't restore your visit to ${country.name}.`, () => { void addVisit(country, values) })
    }
  }

  return {
    addVisit,
    updateVisit,
    removeVisit,
    removedVisit,
    undoRemoveVisit,
    /** Drop the Undo (its toast timed out, or the country went). */
    dismissRemovedVisit,
    /** Before a Reset: waits for an in-flight visit removal. */
    settled: () => pendingRemoval.current,
  }
}
