import { useState } from 'react'
import type { VisitedCountry } from '../types'
import type { CountryJournalUpdates } from '../lib/countriesClient'
import JournalFields from './JournalFields'
import { journalValuesOf } from '../lib/journal'

interface CountryDetailModalProps {
  country: VisitedCountry
  onSave: (updates: CountryJournalUpdates) => void
  onClose: () => void
}

export default function CountryDetailModal({ country, onSave, onClose }: CountryDetailModalProps) {
  const [values, setValues] = useState(() => journalValuesOf(country))
  const handleSave = () => onSave(values)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
                country.status === 'visited' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <h3 className="font-semibold text-gray-800 text-lg">{country.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <JournalFields status={country.status} values={values} onChange={setValues} idPrefix="journal" autoFocusNotes />

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-sm font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
