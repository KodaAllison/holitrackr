import { useState, type ReactNode } from 'react'
import type { Country, VisitedCountry } from '../types'
import type { JournalValues } from '../lib/journal'
import type { ListSort } from '../lib/countryListModel'
import { countryKey } from '../lib/visitedCountries'
import { useMediaQuery } from '../lib/useMediaQuery'
import CountryDetailPanel from './CountryDetailPanel'
import CountryList from './CountryList'
import CountryMarkPanel from './CountryMarkPanel'
import MobileCountrySummary from './MobileCountrySummary'
import MobileSheet from './MobileSheet'
import { SHEET_PEEK } from '../lib/mobileSheet'

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
  /** The countries could not be loaded (the map shows the error and Retry). */
  loadFailed?: boolean
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
 * in place. Below `lg` both live in a `MobileSheet` over the map: the list
 * peeks, a selected country shows its `MobileCountrySummary`, and expanding
 * that ("Edit journal") shows the full panel.
 */
export default function CountrySidebar(props: CountrySidebarProps) {
  const { visitedCountries, selected, onSelect, onBack, onSetStatus, onSaveJournal, onRemove, onReset, loading, loadFailed, listAction } = props
  const { onAddVisit, onUpdateVisit, onRemoveVisit, picked, onMark } = props
  const desktop = useMediaQuery('(min-width: 1024px)')
  // List UI state lives here so it survives the detail panel replacing the list.
  const [tab, setTab] = useState<Status>('visited')
  const [sort, setSort] = useState<ListSort>('continent')
  const [returnKey, setReturnKey] = useState<string | undefined>(undefined)
  // Mobile sheet: expanded or not, reset whenever the selection changes.
  const open = selected ?? picked ?? null
  const selectedKey = open ? countryKey(open) : null
  const [sheet, setSheet] = useState<{ key: string | null; expanded: boolean }>({ key: null, expanded: false })
  const expanded = sheet.key === selectedKey && sheet.expanded
  const setExpanded = (value: boolean) => setSheet({ key: selectedKey, expanded: value })

  const close = () => {
    if (selected) {
      // Come back to the country's own tab, with its row focused.
      setTab(selected.status)
      setReturnKey(countryKey(selected))
    }
    onBack()
  }

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
      loadFailed={loadFailed}
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

  if (selected) {
    return (
      <MobileSheet key={selectedKey} label={selected.name} expanded={expanded} onExpandedChange={setExpanded}>
        {expanded ? detail : (
          <MobileCountrySummary
            country={selected}
            onClose={close}
            onSetStatus={status => onSetStatus(selected, status)}
            onRemove={() => onRemove(selected)}
            onEditJournal={() => setExpanded(true)}
          />
        )}
      </MobileSheet>
    )
  }

  // An unmarked country tapped on the map: its mark panel, sized to fit.
  if (picked) {
    return (
      <MobileSheet key={selectedKey} label={picked.name} expanded={expanded} onExpandedChange={setExpanded}>
        {detail}
      </MobileSheet>
    )
  }

  return (
    <MobileSheet key="list" label="Your countries" expanded={expanded} onExpandedChange={setExpanded} collapsedHeight={SHEET_PEEK}>
      {list}
    </MobileSheet>
  )
}
