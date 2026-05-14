import { useState, useEffect, useRef } from 'react'
import type { VisitedCountry } from '../types'
import { getContinent } from '../lib/continents'

interface VisitedCountriesListProps {
  visitedCountries: VisitedCountry[]
  onRemove: (country: VisitedCountry) => void
  onReset?: () => void
  onEditJournal?: (country: VisitedCountry) => void
}

function formatMonthYear(yyyyMM: string | undefined): string | null {
  if (!yyyyMM) return null
  const [year, month] = yyyyMM.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  if (isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
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

  const stars = country.rating ? '★'.repeat(country.rating) : null

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
          {stars && <span className="text-amber-400 text-xs shrink-0">{stars}</span>}
        </div>
        {(dateLabel || country.notes || (country.tags && country.tags.length > 0)) && (
          <div className="pl-4 mt-0.5 space-y-0.5">
            {dateLabel && <p className="text-xs text-gray-400">{dateLabel}</p>}
            {country.tags && country.tags.length > 0 && (
              <p className="text-xs text-gray-400">{country.tags.slice(0, 3).join(' · ')}</p>
            )}
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
  onEditJournal,
}: VisitedCountriesListProps) {
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null)

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
                onEditJournal={() => onEditJournal?.(country)}
                onRemove={onRemove}
              />
            )
          })}
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
