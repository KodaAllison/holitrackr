import { useState, type ReactNode } from 'react'
import type { VisitedCountry } from '../types'
import { getContinent } from '../lib/continents'
import { countryKey, withStatus } from '../lib/visitedCountries'
import { formatVisitMonth } from '../lib/visitDate'
import StatusPill from './StatusPill'

type Status = VisitedCountry['status']

interface CountryListProps {
  visitedCountries: VisitedCountry[]
  onSelect: (country: VisitedCountry) => void
  onSetStatus: (country: VisitedCountry, status: Status) => void
  onReset?: () => void
  /** Beside the heading, e.g. the mobile Timeline button. */
  action?: ReactNode
}

function groupByContinent(countries: VisitedCountry[]): [string, VisitedCountry[]][] {
  const groups = new Map<string, VisitedCountry[]>()
  for (const country of countries) {
    const continent = getContinent(country.code, country.name)
    groups.set(continent, [...(groups.get(continent) ?? []), country])
  }
  return [...groups.entries()]
    .map(([continent, list]) => [continent, [...list].sort((a, b) => a.name.localeCompare(b.name))] as [string, VisitedCountry[]])
    .sort(([a, al], [b, bl]) => bl.length - al.length || a.localeCompare(b))
}

function subline(country: VisitedCountry): string {
  const when = formatVisitMonth(country.visitedAt)
  if (country.status === 'bucketlist') return when ? `Hoping to go · ${when}` : 'Add when you hope to go'
  return [when, country.place].filter(Boolean).join(' · ') || 'Add a visit date'
}

/** Up/Down move between rows, like a list box, without trapping Tab. */
function onListKeyDown(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  const rows = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-row]')]
  const i = rows.indexOf(document.activeElement as HTMLButtonElement)
  const next = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]
  if (next) {
    e.preventDefault()
    next.focus()
  }
}

/**
 * The sidebar list: Visited / Bucket list tabs with counts, countries grouped
 * by continent, and an inline status pill on every row. Selecting a row
 * opens its detail panel and turns the map to it.
 */
export default function CountryList({ visitedCountries, onSelect, onSetStatus, onReset, action }: CountryListProps) {
  const [tab, setTab] = useState<Status>('visited')
  const visited = withStatus(visitedCountries, 'visited')
  const bucket = withStatus(visitedCountries, 'bucketlist')
  const shown = tab === 'visited' ? visited : bucket
  const tabs: { value: Status; label: string; count: number }[] = [
    { value: 'visited', label: 'Visited', count: visited.length },
    { value: 'bucketlist', label: 'Bucket list', count: bucket.length },
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 pt-4 pb-3 space-y-3 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">Your countries</h2>
          {action}
        </div>
        <div role="tablist" aria-label="Country lists" className="grid grid-cols-2 p-1 gap-1 bg-gray-100 rounded-lg">
          {tabs.map(t => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`h-8 rounded-md text-sm transition-colors ${
                tab === t.value ? 'bg-white shadow-sm font-semibold text-gray-900' : 'font-medium text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label} · {t.count}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div role="tabpanel" className="h-full overflow-y-auto pb-8" onKeyDown={onListKeyDown}>
          {shown.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              {tab === 'visited' ? 'Click a country on the map, or search, to mark it visited.' : 'Nothing on your bucket list yet.'}
            </p>
          ) : (
            groupByContinent(shown).map(([continent, list]) => (
              <section key={continent} aria-label={continent}>
                <h3 className="flex justify-between px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <span>{continent}</span><span>{list.length}</span>
                </h3>
                <ul>
                  {list.map(country => (
                    <li key={countryKey(country)} className="flex items-center gap-2 pr-3 hover:bg-gray-50">
                      <button
                        type="button"
                        data-row
                        onClick={() => onSelect(country)}
                        className="flex-1 min-w-0 text-left pl-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                      >
                        <span className="block font-semibold text-[15px] text-gray-900 truncate">{country.name}</span>
                        <span className="block text-xs text-gray-500 truncate">{subline(country)}</span>
                      </button>
                      <StatusPill status={country.status} name={country.name} onToggle={s => onSetStatus(country, s)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
          {onReset && visitedCountries.length > 0 && (
            <div className="px-4 pt-4">
              <button
                type="button"
                onClick={() => { if (window.confirm('Clear all your countries? This cannot be undone.')) onReset() }}
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                Reset all
              </button>
            </div>
          )}
        </div>
        {/* Fade hints that the list scrolls. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
      </div>
    </div>
  )
}
