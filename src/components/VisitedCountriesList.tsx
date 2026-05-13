import { useState } from 'react'
import type { VisitedCountry } from '../types'
import { getContinent } from '../lib/continents'

interface VisitedCountriesListProps {
  visitedCountries: VisitedCountry[]
  onRemove: (country: VisitedCountry) => void
  onReset?: () => void
  onUpdateNotes?: (country: VisitedCountry, notes: string) => void
}

function formatVisitedAt(isoString: string | undefined, status: 'visited' | 'bucketlist'): string | null {
  if (!isoString) return null
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return null
  const label = status === 'visited' ? 'Visited' : 'Added'
  return `${label} ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
}

interface CountryItemProps {
  country: VisitedCountry
  onRemove: (country: VisitedCountry) => void
  onUpdateNotes?: (country: VisitedCountry, notes: string) => void
}

function CountryItem({ country, onRemove, onUpdateNotes }: CountryItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(country.notes ?? '')

  const dateLabel = formatVisitedAt(country.visitedAt, country.status)

  const handleSave = () => {
    onUpdateNotes?.(country, draft)
    setEditing(false)
  }

  const handleCancel = () => {
    setDraft(country.notes ?? '')
    setEditing(false)
  }

  return (
    <li
      key={`${country.code}-${country.name}`}
      className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full shrink-0 ${
              country.status === 'visited' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="font-medium text-gray-800 truncate">{country.name}</span>
          {onUpdateNotes && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-blue-500 transition-opacity"
              aria-label={`Edit notes for ${country.name}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z" />
              </svg>
            </button>
          )}
        </div>
        {dateLabel && (
          <p className="text-xs text-gray-400 mt-0.5 pl-4">{dateLabel}</p>
        )}
        {!editing && country.notes && (
          <p className="text-xs text-gray-500 mt-0.5 pl-4 truncate">{country.notes}</p>
        )}
        {editing && (
          <div className="mt-1 pl-4 space-y-1">
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Add a note…"
              rows={2}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleSave}
                className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(country)}
        className="shrink-0 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors mt-0.5"
        aria-label={`Remove ${country.name}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  )
}

export default function VisitedCountriesList({
  visitedCountries,
  onRemove,
  onReset,
  onUpdateNotes,
}: VisitedCountriesListProps) {
  const handleReset = () => {
    if (window.confirm('Clear all visited countries? This cannot be undone.')) {
      onReset?.()
    }
  }

  const visited = visitedCountries.filter(v => v.status === 'visited')
  const bucketList = visitedCountries.filter(v => v.status === 'bucketlist')

  function groupByContinent(countries: VisitedCountry[]): Map<string, VisitedCountry[]> {
    const map = new Map<string, VisitedCountry[]>()
    for (const country of countries) {
      const continent = getContinent(country.code)
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
          {items.map(country => (
            <CountryItem
              key={`${country.code}-${country.name}`}
              country={country}
              onRemove={onRemove}
              onUpdateNotes={onUpdateNotes}
            />
          ))}
        </ul>
      </li>
    ))
  }

  return (
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
  )
}
