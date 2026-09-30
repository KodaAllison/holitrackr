import { useEffect, useRef } from 'react'
import type { VisitedCountry } from '../types'
import { groupCountries, type ListSort } from '../lib/countryListModel'
import { countryKey, withStatus } from '../lib/visitedCountries'
import CountryRow from './CountryRow'
import KeyboardLegend from './KeyboardLegend'
import SidebarEmpty from './SidebarEmpty'
import SidebarSkeleton from './SidebarSkeleton'
import SortMenu from './SortMenu'

type Status = VisitedCountry['status']

interface CountryListProps {
  visitedCountries: VisitedCountry[]
  tab: Status
  onTabChange: (tab: Status) => void
  sort: ListSort
  onSortChange: (sort: ListSort) => void
  onSelect: (country: VisitedCountry) => void
  onSetStatus: (country: VisitedCountry, status: Status) => void
  onReset?: () => void
  /** Row to focus on mount, e.g. the country whose detail just closed. */
  focusKey?: string
  loading?: boolean
}

/** Up/Down move between rows, like a list box, without trapping Tab. */
function onListKeyDown(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  const rows = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-row]')]
  const current = document.activeElement?.closest('li')?.querySelector<HTMLButtonElement>('[data-row]')
  const i = current ? rows.indexOf(current) : -1
  const next = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]
  if (next) {
    e.preventDefault()
    next.focus()
  }
}

const HEADING = 'flex justify-between px-2 pb-1 text-xs font-semibold uppercase tracking-[0.06em] text-[#5B6675]'

/**
 * The sidebar list: "Your countries" with a sort menu, Visited / Bucket list
 * tabs with counts, and rows grouped by continent (or flat by date / name).
 */
export default function CountryList(props: CountryListProps) {
  const { visitedCountries, tab, onTabChange, sort, onSortChange, onSelect, onSetStatus, onReset, focusKey, loading } = props
  const panel = useRef<HTMLDivElement>(null)
  const visited = withStatus(visitedCountries, 'visited')
  const bucket = withStatus(visitedCountries, 'bucketlist')
  const shown = tab === 'visited' ? visited : bucket
  const tabs: { value: Status; label: string; count: number }[] = [
    { value: 'visited', label: 'Visited', count: visited.length },
    { value: 'bucketlist', label: 'Bucket list', count: bucket.length },
  ]
  const empty = !loading && visitedCountries.length === 0

  // Return focus to the row whose detail just closed (mount only).
  const initialFocus = useRef(focusKey)
  useEffect(() => {
    const key = initialFocus.current
    if (!key) return
    const row = [...(panel.current?.querySelectorAll<HTMLButtonElement>('[data-row]') ?? [])].find(r => r.dataset.row === key)
    row?.focus()
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-3 px-5 pb-2 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1E293B]">Your countries</h2>
          {!empty && !loading && <SortMenu value={sort} onChange={onSortChange} />}
        </div>
        {!empty && !loading && (
          <div role="tablist" aria-label="Country lists" className="grid grid-cols-2 gap-1 rounded-[10px] bg-[#EEF2F6] p-1">
            {tabs.map(t => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => onTabChange(t.value)}
                className={`h-9 rounded-[7px] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                  tab === t.value
                    ? 'bg-white font-semibold text-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.12)]'
                    : 'font-medium text-[#5B6675] hover:text-[#1E293B]'
                }`}
              >
                {t.label} · {t.count}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? <SidebarSkeleton /> : empty ? <SidebarEmpty /> : (
        <div className="relative min-h-0 flex-1">
          <div ref={panel} role="tabpanel" className="h-full overflow-y-auto px-3 pb-14" onKeyDown={onListKeyDown}>
            {shown.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-[#5B6675]">
                {tab === 'visited' ? 'Click a country on the map, or search, to mark it visited.' : 'Nothing on your bucket list yet.'}
              </p>
            ) : (
              groupCountries(shown, sort).map((group, gi) => (
                <section key={group.heading ?? 'all'} aria-label={group.heading ?? undefined}>
                  {group.heading && (
                    <h3 className={`${HEADING} ${gi === 0 ? 'pt-2' : 'pt-3'}`}><span>{group.heading}</span><span>{group.countries.length}</span></h3>
                  )}
                  <ul className={group.heading ? undefined : 'pt-1'}>
                    {group.countries.map(country => (
                      <CountryRow key={countryKey(country)} country={country} onSelect={onSelect} onSetStatus={onSetStatus} />
                    ))}
                  </ul>
                </section>
              ))
            )}
            {onReset && (
              <div className="px-2 pt-4">
                <button
                  type="button"
                  onClick={() => { if (window.confirm('Clear all your countries? This cannot be undone.')) onReset() }}
                  className="text-xs font-medium text-[#B42318] hover:underline"
                >
                  Reset all
                </button>
              </div>
            )}
          </div>
          {/* Fade hints that the list scrolls. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-white/0 to-white" />
        </div>
      )}
      {!empty && !loading && <KeyboardLegend />}
    </div>
  )
}
