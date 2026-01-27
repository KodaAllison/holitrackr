import type { Country } from '../types'

interface VisitedCountriesListProps {
  visitedCountryCodes: string[]
  countries: Country[]
  onRemove: (countryCode: string) => void
}

export default function VisitedCountriesList({
  visitedCountryCodes,
  countries,
  onRemove,
}: VisitedCountriesListProps) {
  const codeToName = (code: string) =>
    countries.find((c) => c.code === code)?.name ?? code

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col h-full min-h-0">
      <h2 className="px-4 py-3 font-semibold text-gray-800 border-b border-gray-100 shrink-0">
        Visited countries
      </h2>
      <ul className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0 list-none">
        {visitedCountryCodes.length === 0 ? (
          <li className="py-4 text-center text-gray-500 text-sm">
            No countries selected. Click the map or search to add some.
          </li>
        ) : (
          visitedCountryCodes.map((code) => (
            <li
              key={code}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 group"
            >
              <span className="font-medium text-gray-800 truncate">
                {codeToName(code)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(code)}
                className="shrink-0 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                aria-label={`Remove ${codeToName(code)}`}
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
