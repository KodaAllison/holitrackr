import { useState } from 'react'
import type { VisitedCountry } from '../types'

const PRESET_TAGS = ['Food', 'Culture', 'Nature', 'Adventure', 'Work', 'Beach', 'City', 'Wildlife', 'History']

interface CountryDetailModalProps {
  country: VisitedCountry
  onSave: (updates: { notes: string; visitedAt: string; rating: number | undefined; tags: string[] }) => void
  onClose: () => void
}

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

export default function CountryDetailModal({ country, onSave, onClose }: CountryDetailModalProps) {
  const [notes, setNotes] = useState(country.notes ?? '')
  const [visitedAt, setVisitedAt] = useState(country.visitedAt ?? '')
  const [rating, setRating] = useState<number | undefined>(country.rating)
  const [tags, setTags] = useState<string[]>(country.tags ?? [])

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const handleSave = () => {
    onSave({ notes, visitedAt, rating, tags })
  }

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

        {/* Visit Date — visited only */}
        {country.status === 'visited' && (
          <div>
            <label className="text-sm text-gray-500 mb-1 block">When did you visit?</label>
            <input
              type="month"
              value={visitedAt}
              onChange={e => setVisitedAt(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}

        {/* Star Rating — visited only */}
        {country.status === 'visited' && (
          <div>
            <label className="text-sm text-gray-500 mb-1.5 block">Rating</label>
            <StarRating value={rating} onChange={setRating} />
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
            autoFocus
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Hiked the Inca Trail…"
            rows={4}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

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
