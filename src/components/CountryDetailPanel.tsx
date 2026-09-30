import { useEffect, useRef, useState } from 'react'
import type { VisitedCountry } from '../types'
import { getContinent } from '../lib/continents'
import { journalValuesOf, type JournalValues } from '../lib/journal'
import AutosaveStatus, { type SaveState } from './AutosaveStatus'
import JournalFields from './JournalFields'
import StatusControl from './StatusControl'
import VisitList from './VisitList'

type Status = VisitedCountry['status']

interface CountryDetailPanelProps {
  country: VisitedCountry
  onBack: () => void
  onSetStatus: (status: Status) => void
  /** Resolves once saved; rejects if the save failed (the edit is kept here). */
  onSave: (values: JournalValues) => Promise<void>
  onRemove: () => void
  onAddVisit: (values: JournalValues) => void
  onUpdateVisit: (id: number, values: JournalValues) => void
  onRemoveVisit: (id: number) => void
}

const AUTOSAVE_MS = 600

/**
 * One country's detail: continent and name, the status buttons, and the
 * journal edited inline with autosave. Esc closes it. Mount it with a `key`
 * per country so its form state starts fresh.
 */
export default function CountryDetailPanel(props: CountryDetailPanelProps) {
  const { country, onBack, onSetStatus, onSave, onRemove, onAddVisit, onUpdateVisit, onRemoveVisit } = props
  const [values, setValues] = useState(() => journalValuesOf(country))
  const [saved, setSaved] = useState<SaveState>('idle')
  const save = useRef(onSave)
  const back = useRef(onBack)
  useEffect(() => { save.current = onSave; back.current = onBack })

  // Esc closes the panel (menus and editors that handle Esc first prevent this).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) back.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Autosave shortly after the last edit.
  const dirty = saved === 'pending'
  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => {
      setSaved('saving')
      // "Saved" only once the server confirms; on failure keep the edit and say so.
      save.current(values).then(
        () => setSaved(s => (s === 'saving' ? 'saved' : s)),
        () => setSaved(s => (s === 'saving' ? 'failed' : s)),
      )
    }, AUTOSAVE_MS)
    return () => window.clearTimeout(timer)
  }, [values, dirty])

  // Flush an unsaved edit if the panel closes before the timer fires.
  const latest = useRef({ values, dirty })
  useEffect(() => { latest.current = { values, dirty } })
  useEffect(() => () => {
    if (latest.current.dirty) save.current(latest.current.values).catch(() => undefined)
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between px-3 pt-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 items-center gap-1 rounded-lg pl-1.5 pr-3 text-sm font-medium text-[#334155] hover:bg-[#F7F9FB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          All countries
        </button>
        <button
          type="button"
          onClick={onBack}
          aria-label="Close (Esc)"
          title="Close (Esc)"
          className="flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-[#F7F9FB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6675" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-5 pb-4 pt-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5B6675]">{getContinent(country.code, country.name)}</span>
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.01em] text-[#1E293B]">{country.name}</h2>
        </div>

        <StatusControl status={country.status} onSetStatus={onSetStatus} onRemove={onRemove} />

        <div className="h-px shrink-0 bg-[#E4E9EE]" />

        <section aria-labelledby="journal-heading" className="flex flex-col gap-3">
          <h3 id="journal-heading" className="text-[15px] font-bold text-[#1E293B]">Journal</h3>
          <JournalFields
            status={country.status}
            values={values}
            onChange={v => { setValues(v); setSaved('pending') }}
            idPrefix="detail"
          />
        </section>

        {country.status === 'visited' && (
          <VisitList country={country} onAdd={onAddVisit} onUpdate={onUpdateVisit} onRemove={onRemoveVisit} />
        )}
      </div>

      <div className="shrink-0 px-5 pb-4 pt-3">
        <AutosaveStatus state={saved} onRetry={() => setSaved('pending')} />
      </div>
    </div>
  )
}
