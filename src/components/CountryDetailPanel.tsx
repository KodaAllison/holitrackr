import { useEffect, useRef, useState } from 'react'
import type { VisitedCountry } from '../types'
import { journalValuesOf, type JournalValues } from '../lib/journal'
import JournalFields from './JournalFields'
import StatusPill from './StatusPill'

type Status = VisitedCountry['status']

interface CountryDetailPanelProps {
  country: VisitedCountry
  onBack: () => void
  onSetStatus: (status: Status) => void
  onSave: (values: JournalValues) => void
  onRemove: () => void
}

const AUTOSAVE_MS = 600

/**
 * One country's detail: status, and the journal edited inline with autosave.
 * Mount it with a `key` per country so its form state starts fresh.
 */
export default function CountryDetailPanel({ country, onBack, onSetStatus, onSave, onRemove }: CountryDetailPanelProps) {
  const [values, setValues] = useState(() => journalValuesOf(country))
  const [saved, setSaved] = useState<'idle' | 'pending' | 'saved'>('idle')
  const save = useRef(onSave)
  useEffect(() => { save.current = onSave })

  // Autosave shortly after the last edit.
  const dirty = saved === 'pending'
  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => {
      save.current(values)
      setSaved('saved')
    }, AUTOSAVE_MS)
    return () => window.clearTimeout(timer)
  }, [values, dirty])

  // Flush an unsaved edit if the panel closes before the timer fires.
  const latest = useRef({ values, dirty })
  useEffect(() => { latest.current = { values, dirty } })
  useEffect(() => () => { if (latest.current.dirty) save.current(latest.current.values) }, [])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-gray-100">
        <button type="button" onClick={onBack} aria-label="Back to your countries" className="h-8 w-8 rounded-full text-gray-500 hover:bg-gray-100 text-lg leading-none">‹</button>
        <h2 className="flex-1 min-w-0 text-lg font-bold text-gray-900 truncate">{country.name}</h2>
        <StatusPill status={country.status} name={country.name} onToggle={onSetStatus} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        <JournalFields
          status={country.status}
          values={values}
          onChange={v => { setValues(v); setSaved('pending') }}
          idPrefix="detail"
        />
      </div>
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
        <span role="status" className="text-xs text-gray-400">
          {saved === 'pending' ? 'Saving…' : saved === 'saved' ? 'Saved' : 'Changes save automatically'}
        </span>
        <button type="button" onClick={onRemove} className="text-xs font-medium text-red-600 hover:text-red-700">
          Remove from my atlas
        </button>
      </div>
    </div>
  )
}
