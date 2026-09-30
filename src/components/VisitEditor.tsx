import { useState } from 'react'
import type { JournalValues } from '../lib/journal'
import { isVisitMonth } from '../lib/visitDate'
import JournalFields from './JournalFields'

interface VisitEditorProps {
  initial: JournalValues
  /** Prefix for the form's input ids. */
  idPrefix: string
  saveLabel: string
  onSave: (values: JournalValues) => void
  onCancel: () => void
}

/**
 * The journal form for one extra visit, with Save / Cancel. Unlike the
 * country's own journal it needs a date: an extra visit is a dated trip.
 */
export default function VisitEditor({ initial, idPrefix, saveLabel, onSave, onCancel }: VisitEditorProps) {
  const [values, setValues] = useState(initial)
  const dated = isVisitMonth(values.visitedAt)

  return (
    <div className="space-y-4 rounded-lg border border-blue-100 bg-gray-50 p-3">
      <JournalFields status="visited" values={values} onChange={setValues} idPrefix={idPrefix} />
      {!dated && <p className="text-xs text-gray-500">Add the month of this visit to save it.</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!dated}
          onClick={() => onSave(values)}
          className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
