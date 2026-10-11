import { useRef, useState, type ReactNode } from 'react'
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
import { SHEET_PEEK, sheetIsModal } from '../lib/mobileSheet'
import { usePanelFocusReturn } from '../lib/usePanelFocus'

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
 * that ("Edit journal") shows the full panel, as a modal sheet.
 *
 * Focus: a panel's heading takes it as the panel opens; on close it goes
 * back to the country's row, else to what opened it, else the list heading
 * (`usePanelFocusReturn`).
 */
export default function CountrySidebar(props: CountrySidebarProps) {
  const { visitedCountries, selected, onSelect, onBack, onSetStatus, onSaveJournal, onRemove, onReset, loading, loadFailed, listAction } = props
  const { onAddVisit, onUpdateVisit, onRemoveVisit, picked, onMark } = props
  const desktop = useMediaQuery('(min-width: 1024px)')
  // List UI state lives here so it survives the detail panel replacing the list.
  const [tab, setTab] = useState<Status>('visited')
  const [sort, setSort] = useState<ListSort>('continent')
  const scope = useRef<HTMLDivElement>(null)
  // Mobile sheet: expanded or not, reset whenever the selection changes.
  const open = selected ?? picked ?? null
  const selectedKey = open ? countryKey(open) : null
  const [sheet, setSheet] = useState<{ key: string | null; expanded: boolean }>({ key: null, expanded: false })
  const expanded = sheet.key === selectedKey && sheet.expanded
  const setExpanded = (value: boolean) => setSheet({ key: selectedKey, expanded: value })
  // The list comes back on the open country's own tab, so its row is there to focus.
  // (Adjusting state while rendering; the list is hidden while a country is open.)
  if (selected && selected.status !== tab) setTab(selected.status)
  usePanelFocusReturn(scope, selectedKey)
  const modal = sheetIsModal({ hasCountry: Boolean(open), expanded })

  const detail = selected ? (
    <CountryDetailPanel
      key={countryKey(selected)}
      country={selected}
      onBack={onBack}
      onSetStatus={status => onSetStatus(selected, status)}
      onSave={values => onSaveJournal(selected, values)}
      onRemove={() => onRemove(selected)}
      onAddVisit={values => onAddVisit(selected, values)}
      onUpdateVisit={onUpdateVisit}
      onRemoveVisit={onRemoveVisit}
    />
  ) : picked && (
    <CountryMarkPanel key={countryKey(picked)} country={picked} onBack={onBack} onMark={status => onMark?.(picked, status)} />
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
      loading={loading}
      loadFailed={loadFailed}
      action={listAction}
    />
  )

  // Below `lg`: a selected country's summary (expanding into the panel), an
  // unmarked tapped country's mark panel sized to fit, or the list.
  const sheetContent = selected ? (expanded ? detail : (
    <MobileCountrySummary
      country={selected}
      onClose={onBack}
      onSetStatus={status => onSetStatus(selected, status)}
      onRemove={() => onRemove(selected)}
      onEditJournal={() => setExpanded(true)}
    />
  )) : detail
  const content = desktop ? (
    <aside aria-label={open ? open.name : 'Your countries'} className="flex h-full min-h-[420px] flex-col border-l border-[#D7DEE5] bg-white">
      {detail || list}
    </aside>
  ) : open ? (
    <MobileSheet key={selectedKey} label={open.name} expanded={expanded} onExpandedChange={setExpanded} modal={modal}>
      {sheetContent}
    </MobileSheet>
  ) : (
    <MobileSheet key="list" label="Your countries" expanded={expanded} onExpandedChange={setExpanded} collapsedHeight={SHEET_PEEK}>
      {list}
    </MobileSheet>
  )

  // `contents`: no box of its own, just the focus scope around the aside / sheet.
  return <div ref={scope} data-focus-scope className="contents">{content}</div>
}
