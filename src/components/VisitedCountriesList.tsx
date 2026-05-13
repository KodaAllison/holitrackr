import { useState, useEffect, useRef } from 'react'
import type { VisitedCountry } from '../types'
import { getContinent } from '../lib/continents'

interface VisitedCountriesListProps {
  visitedCountries: VisitedCountry[]
  onRemove: (country: VisitedCountry) => void
  onReset?: () => void
  onUpdateJournal?: (country: VisitedCountry, notes: string, visitedAt: string) => void
}

function formatMonthYear(yyyyMM: string | undefined): string | null {
  if (!yyyyMM) return null
  const [year, month] = yyyyMM.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  if (isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

interface JournalModalProps {
  country: VisitedCountry
  onSave: (notes: string, visitedAt: string) => void
  onClose: () => void
}

function JournalModal({ country, onSave, onClose }: JournalModalProps) {
  const [notes, setNotes] = useState(country.notes ?? '')
  const [visitedAt, setVisitedAt] = useState(country.visitedAt ?? '')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
                country.status === 'visited' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <h3 className="font-semibold text-gray-800">{country.name}</h3>
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

        <div>
          <label className="text-sm text-gray-500 mb-1 block">Notes</label>
          <textarea
            autoFocus
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Hiked the Inca Trail…"
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => onSave(notes, visitedAt)}
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

interface CountryItemProps {
  country: VisitedCountry
  menuOpen: boolean
  onMenuToggle: () => void
  onMenuClose: () => void
  onEditJournal: () => void
  onRemove: (country: VisitedCountry) => void
}

function CountryItem({ country, menuOpen, onMenuToggle, onMenuClose, onEditJournal, onRemove }: CountryItemProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const dateLabel = formatMonthYear(country.visitedAt)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onMenuClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen, onMenuClose])

  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full shrink-0 ${
              country.status === 'visited' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="font-medium text-gray-800 truncate">{country.name}</span>
        </div>
        {(dateLabel || country.notes) && (
          <div className="pl-4 mt-0.5 space-y-0.5">
            {dateLabel && <p className="text-xs text-gray-400">{dateLabel}</p>}
            {country.notes && <p className="text-xs text-gray-400 truncate">{country.notes}</p>}
          </div>
        )}
      </div>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={onMenuToggle}
          className="p-1.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          aria-label={`Options for ${country.name}`}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden">
            <button
              type="button"
              onClick={() => { onMenuClose(); onEditJournal() }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Edit journal
            </button>
            <button
              type="button"
              onClick={() => { onMenuClose(); onRemove(country) }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

export default function VisitedCountriesList({
  visitedCountries,
  onRemove,
  onReset,
  onUpdateJournal,
}: VisitedCountriesListProps) {
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null)
  const [editingCountry, setEditingCountry] = useState<VisitedCountry | null>(null)

  const handleReset = () => {
    if (window.confirm('Clear all visited countries? This cannot be undone.')) {
      onReset?.()
    }
  }

  const handleSave = (notes: string, visitedAt: string) => {
    if (editingCountry) {
      onUpdateJournal?.(editingCountry, notes, visitedAt)
      setEditingCountry(null)
    }
  }

  const visited = visitedCountries.filter(v => v.status === 'visited')
  const bucketList = visitedCountries.filter(v => v.status === 'bucketlist')

  function groupByContinent(countries: VisitedCountry[]): Map<string, VisitedCountry[]> {
    const map = new Map<string, VisitedCountry[]>()
    for (const country of countries) {
      const continent = getContinent(country.code, country.name)
      const existing = map.get(continent)
      if (existing) {
        existing.push(country)
      } else {
        map.set(continent, [country])
      }
    }
    return new Map(
      [...map.entries()].sort(([aName, aList], [bName, bList]) => {
        const diff = bList.length - aList.length
        return diff !== 0 ? diff : aName.localeCompare(bName)
      })
    )
  }

  const renderGroupedCountries = (countries: VisitedCountry[]) => {
    const groups = groupByContinent(countries)
    return [...groups.entries()].map(([continent, items]) => (
      <li key={continent} className="list-none">
        <div className="text-xs text-gray-400 uppercase tracking-wide px-3 pt-2 pb-0.5">
          {continent}
        </div>
        <ul className="list-none space-y-0">
          {items.map(country => {
            const key = `${country.code}-${country.name}`
            return (
              <CountryItem
                key={key}
                country={country}
                menuOpen={openMenuKey === key}
                onMenuToggle={() => setOpenMenuKey(prev => prev === key ? null : key)}
                onMenuClose={() => setOpenMenuKey(null)}
                onEditJournal={() => setEditingCountry(country)}
                onRemove={onRemove}
              />
            )
          })}
        </ul>
      </li>
    ))
  }

  return (
    <>
      {editingCountry && (
        <JournalModal
          country={editingCountry}
          onSave={handleSave}
          onClose={() => setEditingCountry(null)}
        />
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col h-full min-h-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-800">Countries</h2>
          {onReset && visitedCountries.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-lg transition-colors"
            >
              Reset all
            </button>
          )}
        </div>
        <ul className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0 list-none">
          {visitedCountries.length === 0 ? (
            <li className="py-4 text-center text-gray-500 text-sm">
              No countries selected. Click the map or search to add some.
            </li>
          ) : (
            <>
              {visited.length > 0 && (
                <>
                  <li className="px-3 pt-2 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                      Visited
                    </span>
                  </li>
                  {renderGroupedCountries(visited)}
                </>
              )}
              {bucketList.length > 0 && (
                <>
                  <li className="px-3 pt-2 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                      Bucket List
                    </span>
                  </li>
                  {renderGroupedCountries(bucketList)}
                </>
              )}
            </>
          )}
        </ul>
      </div>
    </>
  )
}
