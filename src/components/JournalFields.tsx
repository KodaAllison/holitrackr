import { useState } from 'react'
import type { VisitedCountry } from '../types'
import { PRESET_TAGS, type JournalValues } from '../lib/journal'

function StarRating({ value, onChange }: { value: number | undefined; onChange: (r: number | undefined) => void }) {
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div className="flex gap-1" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = hovered !== null ? star <= hovered : star <= (value ?? 0)
        return (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHovered(star)}
            onClick={() => onChange(value === star ? undefined : star)}
            className={`text-2xl transition-colors leading-none ${active ? 'text-amber-400' : 'text-gray-200'} hover:text-amber-400`}
            aria-label={`${star} star`}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}

interface JournalFieldsProps {
  status: VisitedCountry['status']
  values: JournalValues
  onChange: (values: JournalValues) => void
  /** Prefix for input ids, so two forms can share a page. */
  idPrefix: string
  autoFocusNotes?: boolean
}

/**
 * The journal form fields: when (or "Hoping to go" for the bucket list),
 * where, rating (visited only), tags and notes. Used by the detail panel
 * (autosaving) and the journal modal (Save / Cancel).
 */
export default function JournalFields({ status, values, onChange, idPrefix, autoFocusNotes }: JournalFieldsProps) {
  const { notes, place, visitedAt, rating, tags } = values
  const set = (patch: Partial<JournalValues>) => onChange({ ...values, ...patch })
  const toggleTag = (tag: string) => set({ tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag] })

  return (
    <>
        {/* Visit date; for the bucket list the same field is "Hoping to go" */}
        <div>
          <label htmlFor={`${idPrefix}-when`} className="text-sm text-gray-500 mb-1 block">
            {status === 'visited' ? 'When did you visit?' : 'Hoping to go'}
          </label>
          <input
            id={`${idPrefix}-when`}
            type="month"
            value={visitedAt}
            onChange={e => set({ visitedAt: e.target.value })}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Place */}
        <div>
          <label htmlFor={`${idPrefix}-place`} className="text-sm text-gray-500 mb-1 block">
            {status === 'visited' ? 'Where?' : 'Where to?'}
          </label>
          <input
            id={`${idPrefix}-place`}
            type="text"
            value={place}
            maxLength={120}
            onChange={e => set({ place: e.target.value })}
            placeholder="e.g. Kyoto & Osaka"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Star Rating — visited only */}
        {status === 'visited' && (
          <div>
            <label className="text-sm text-gray-500 mb-1.5 block">Rating</label>
            <StarRating value={rating} onChange={r => set({ rating: r })} />
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="text-sm text-gray-500 mb-2 block">Tags</label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  tags.includes(tag)
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-500'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm text-gray-500 mb-1 block">Notes</label>
          <textarea
            autoFocus={autoFocusNotes}
            value={notes}
            onChange={e => set({ notes: e.target.value })}
            placeholder="e.g. Hiked the Inca Trail…"
            rows={4}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

    </>
  )
}
