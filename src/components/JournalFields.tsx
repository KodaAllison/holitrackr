import type { VisitedCountry } from '../types'
import type { JournalValues } from '../lib/journal'
import StarRating from './StarRating'
import TagPicker from './TagPicker'

interface JournalFieldsProps {
  status: VisitedCountry['status']
  values: JournalValues
  onChange: (values: JournalValues) => void
  /** Prefix for input ids, so two forms can share a page. */
  idPrefix: string
  autoFocusNotes?: boolean
}

const LABEL = 'flex flex-col gap-1.5 text-[13px] font-medium text-[#334155]'
const INPUT = 'h-10 rounded-lg border border-[#C7D0D9] bg-white px-2.5 text-sm font-normal text-[#1E293B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]'

/**
 * The journal form fields: When (or "Hoping to go" for the bucket list),
 * Where, Rating (visited only), Tags and Notes. Used by the detail panel
 * (autosaving), extra visits and the journal modal (Save / Cancel).
 */
export default function JournalFields({ status, values, onChange, idPrefix, autoFocusNotes }: JournalFieldsProps) {
  const { notes, place, visitedAt, rating, tags } = values
  const set = (patch: Partial<JournalValues>) => onChange({ ...values, ...patch })
  const toggleTag = (tag: string) => set({ tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag] })

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`${idPrefix}-when`} className={LABEL}>
        {status === 'visited' ? 'When' : 'Hoping to go'}
        <input id={`${idPrefix}-when`} type="month" value={visitedAt} onChange={e => set({ visitedAt: e.target.value })} className={INPUT} />
      </label>

      <label htmlFor={`${idPrefix}-place`} className={LABEL}>
        Where
        <input
          id={`${idPrefix}-place`}
          type="text"
          value={place}
          maxLength={120}
          onChange={e => set({ place: e.target.value })}
          placeholder="e.g. Kyoto & Osaka"
          className={INPUT}
        />
      </label>

      {status === 'visited' && (
        <div className="flex flex-col gap-1.5 text-[13px] font-medium text-[#334155]">
          <span>Rating</span>
          <StarRating value={rating} onChange={r => set({ rating: r })} />
        </div>
      )}

      <TagPicker tags={tags} onToggle={toggleTag} />

      <label htmlFor={`${idPrefix}-notes`} className={LABEL}>
        Notes
        <textarea
          id={`${idPrefix}-notes`}
          autoFocus={autoFocusNotes}
          value={notes}
          onChange={e => set({ notes: e.target.value })}
          placeholder="e.g. Hiked the Inca Trail…"
          rows={4}
          className="resize-none rounded-lg border border-[#C7D0D9] bg-white px-3 py-2.5 text-sm font-normal leading-normal text-[#1E293B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
        />
      </label>
    </div>
  )
}
