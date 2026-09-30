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
    <div
      className="flex flex-col gap-3 rounded-[10px] border border-[#C7D0D9] bg-[#F7F9FB] p-3"
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onCancel() } }}
    >
      <JournalFields status="visited" values={values} onChange={setValues} idPrefix={idPrefix} />
      {!dated && <p className="text-[13px] text-[#5B6675]">Add the month of this visit to save it.</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!dated}
          onClick={() => onSave(values)}
          className="h-10 flex-1 rounded-lg bg-[#2563EB] text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 flex-1 rounded-lg border border-[#C7D0D9] bg-white text-sm font-medium text-[#334155] hover:bg-[#EEF2F6]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
