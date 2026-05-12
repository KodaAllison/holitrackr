import type { VisitedCountry } from '../types'
import { getContinent } from '../lib/continents'

interface VisitedCountriesListProps {
  visitedCountries: VisitedCountry[]
  onRemove: (country: VisitedCountry) => void
  onReset?: () => void
}

export default function VisitedCountriesList({
  visitedCountries,
  onRemove,
  onReset,
}: VisitedCountriesListProps) {
  const handleReset = () => {
    if (
      window.confirm('Clear all visited countries? This cannot be undone.')
    ) {
      onReset?.()
    }
  }

  const visited = visitedCountries.filter(v => v.status === 'visited')
  const bucketList = visitedCountries.filter(v => v.status === 'bucketlist')

  const renderCountryItem = (country: VisitedCountry) => (
    <li
      key={`${country.code}-${country.name}`}
      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 group"
    >
      <span className="font-medium text-gray-800 truncate flex items-center">
        <span
          className={`inline-block w-2 h-2 rounded-full mr-2 shrink-0 ${
            country.status === 'visited' ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />
        {country.name}
      </span>
      <button
        type="button"
        onClick={() => onRemove(country)}
        className="shrink-0 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        aria-label={`Remove ${country.name}`}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </li>
  )

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
    // Sort continents: more entries first, then alphabetically as a tiebreaker
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
          {items.map(renderCountryItem)}
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
