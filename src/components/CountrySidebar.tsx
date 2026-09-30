import { useState, type ReactNode } from 'react'
import type { Country, VisitedCountry } from '../types'
import type { JournalValues } from '../lib/journal'
import type { ListSort } from '../lib/countryListModel'
import { countryKey } from '../lib/visitedCountries'
import { useMediaQuery } from '../lib/useMediaQuery'
import CountryDetailPanel from './CountryDetailPanel'
import CountryList from './CountryList'
import CountryMarkPanel from './CountryMarkPanel'

type Status = VisitedCountry['status']

interface CountrySidebarProps {
  visitedCountries: VisitedCountry[]
  selected: VisitedCountry | null
  onSelect: (country: VisitedCountry) => void
  onBack: () => void
  onSetStatus: (country: VisitedCountry, status: Status) => void
  onSaveJournal: (country: VisitedCountry, values: JournalValues) => Promise<void>
  onRemove: (country: VisitedCountry) => void
  onAddVisit: (country: VisitedCountry, values: JournalValues) => void
  onUpdateVisit: (id: number, values: JournalValues) => void
  onRemoveVisit: (id: number) => void
  onReset?: () => void
  /** While the countries load, the list shows skeleton rows. */
  loading?: boolean
  /** Beside the list's heading (mobile: the Timeline button). */
  listAction?: ReactNode
  /** An unmarked country opened from the map (shown when nothing marked is selected). */
  picked?: Country | null
  /** Mark the picked country. */
  onMark?: (country: Country, status: Status) => void
}

/**
 * The map's sidebar: the country list, or one country's detail panel. On
 * desktop it fills its container's height and the panel replaces the list
 * in place; on smaller screens the list stays and the panel opens as a
 * bottom sheet.
 */
export default function CountrySidebar(props: CountrySidebarProps) {
  const { visitedCountries, selected, onSelect, onBack, onSetStatus, onSaveJournal, onRemove, onReset, loading, listAction } = props
  const { onAddVisit, onUpdateVisit, onRemoveVisit, picked, onMark } = props
  const desktop = useMediaQuery('(min-width: 1024px)')
  // List UI state lives here so it survives the detail panel replacing the list.
  const [tab, setTab] = useState<Status>('visited')
  const [sort, setSort] = useState<ListSort>('continent')
  const [returnKey, setReturnKey] = useState<string | undefined>(undefined)

  const close = () => {
    if (selected) {
      // Come back to the country's own tab, with its row focused.
      setTab(selected.status)
      setReturnKey(countryKey(selected))
    }
    onBack()
  }

  const open = selected ?? picked ?? null
  const detail = selected ? (
    <CountryDetailPanel
      key={countryKey(selected)}
      country={selected}
      onBack={close}
      onSetStatus={status => onSetStatus(selected, status)}
      onSave={values => onSaveJournal(selected, values)}
      onRemove={() => onRemove(selected)}
      onAddVisit={values => onAddVisit(selected, values)}
      onUpdateVisit={onUpdateVisit}
      onRemoveVisit={onRemoveVisit}
    />
  ) : picked && (
    <CountryMarkPanel key={countryKey(picked)} country={picked} onBack={close} onMark={status => onMark?.(picked, status)} />
  )
  const list = (
    <CountryList
      visitedCountries={visitedCountries}
      tab={tab}
      onTabChange={setTab}
      sort={sort}
      onSortChange={setSort}
      onSelect={onSelect}
      onSetStatus={onSetStatus}
      onReset={onReset}
      focusKey={returnKey}
      loading={loading}
      action={listAction}
    />
  )

  if (desktop) {
    return (
      <aside aria-label={open ? open.name : 'Your countries'} className="flex h-full min-h-[420px] flex-col border-l border-[#D7DEE5] bg-white">
        {detail || list}
      </aside>
    )
  }

  return (
    <>
      {/* The app shell's sheet provides the rounded edge and grab handle. */}
      <aside aria-label="Your countries" className="h-[65dvh] min-h-[380px] overflow-hidden bg-white">{list}</aside>
      {open && detail && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30" onClick={close} />
          <div role="dialog" aria-label={open.name} className="relative flex h-[80vh] max-h-[80vh] flex-col rounded-t-[20px] bg-white shadow-2xl">
            <div aria-hidden="true" className="mx-auto mt-2 h-[5px] w-10 shrink-0 rounded-full bg-[#D7DEE5]" />
            <div className="min-h-0 flex-1">{detail}</div>
          </div>
        </div>
      )}
    </>
  )
}
