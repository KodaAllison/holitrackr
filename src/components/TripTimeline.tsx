import type { VisitedCountry } from '../types'

interface TripTimelineProps {
  visitedCountries: VisitedCountry[]
}

function parseYearMonth(visitedAt: string): { year: number; month: number } | null {
  const parts = visitedAt.split('-')
  if (parts.length < 2) return null
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  if (isNaN(year) || isNaN(month)) return null
  return { year, month }
}

function formatMonth(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleDateString('en-US', { month: 'long' })
}

interface TimelineEntry {
  country: VisitedCountry
  month: number
  sortKey: number
}

export default function TripTimeline({ visitedCountries }: TripTimelineProps) {
  const visited = visitedCountries.filter(v => v.status === 'visited')

  const withDate: { year: number; entries: TimelineEntry[] }[] = []
  const noDate: VisitedCountry[] = []
  const yearMap = new Map<number, TimelineEntry[]>()

  for (const country of visited) {
    if (!country.visitedAt) {
      noDate.push(country)
      continue
    }
    const parsed = parseYearMonth(country.visitedAt)
    if (!parsed) {
      noDate.push(country)
      continue
    }
    const { year, month } = parsed
    const existing = yearMap.get(year)
    const entry: TimelineEntry = { country, month, sortKey: month }
    if (existing) {
      existing.push(entry)
    } else {
      yearMap.set(year, [entry])
    }
  }

  // Sort years descending, entries within each year by month ascending
  const sortedYears = [...yearMap.keys()].sort((a, b) => b - a)
  for (const year of sortedYears) {
    const entries = yearMap.get(year)!
    entries.sort((a, b) => a.sortKey - b.sortKey)
    withDate.push({ year, entries })
  }

  if (visited.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-12 h-12 mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">No visited countries yet.</p>
        <p className="text-xs mt-1">Mark countries as visited on the map to see your timeline.</p>
      </div>
    )
  }

  if (withDate.length === 0 && noDate.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-12 h-12 mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm font-medium">No visit dates recorded.</p>
        <p className="text-xs mt-1">Edit the journal for each country to add when you visited.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {withDate.map(({ year, entries }) => (
        <div key={year} className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl font-bold text-gray-800">{year}</span>
            <span className="text-sm text-gray-400 font-medium">
              {entries.length} {entries.length === 1 ? 'country' : 'countries'}
            </span>
          </div>

          <div className="relative ml-3">
            {/* vertical line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200" />

            <div className="space-y-4 pl-6">
              {entries.map(({ country, month }) => (
                <div key={`${country.code}-${country.name}`} className="relative">
                  {/* dot on the line */}
                  <span className="absolute -left-[27px] top-[6px] w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />

                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-800">{country.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatMonth(month)} {year}</p>
                      </div>
                    </div>
                    {country.notes && (
                      <p className="mt-2 text-sm text-gray-500 leading-relaxed">{country.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {noDate.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-lg font-semibold text-gray-400">No date recorded</span>
            <span className="text-sm text-gray-400">
              {noDate.length} {noDate.length === 1 ? 'country' : 'countries'}
            </span>
          </div>

          <div className="relative ml-3">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-100" />
            <div className="space-y-3 pl-6">
              {noDate.map(country => (
                <div key={`${country.code}-${country.name}`} className="relative">
                  <span className="absolute -left-[27px] top-[6px] w-2.5 h-2.5 rounded-full bg-gray-300 ring-2 ring-white" />
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                    <p className="font-medium text-gray-600">{country.name}</p>
                    {country.notes && (
                      <p className="mt-1 text-sm text-gray-400 leading-relaxed">{country.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
