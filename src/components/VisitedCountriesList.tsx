import type { VisitedCountry } from '../types'

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

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <h2 className="font-semibold text-gray-800">Visited countries</h2>
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
          visitedCountries.map((country) => (
            <li
              key={`${country.code}-${country.name}`}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 group"
            >
              <span className="font-medium text-gray-800 truncate">
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
          ))
        )}
      </ul>
    </div>
  )
}
