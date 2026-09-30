import type { VisitedCountry } from '../types'
import type { JournalValues } from '../lib/journal'
import { countryKey } from '../lib/visitedCountries'
import { useMediaQuery } from '../lib/useMediaQuery'
import CountryDetailPanel from './CountryDetailPanel'
import CountryList from './CountryList'

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
}

const CARD = 'bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden'

/**
 * The map's sidebar: the country list, or one country's detail panel. On
 * desktop the panel replaces the list in place; on smaller screens the list
 * stays and the panel opens as a bottom sheet.
 */
export default function CountrySidebar(props: CountrySidebarProps) {
  const { visitedCountries, selected, onSelect, onBack, onSetStatus, onSaveJournal, onRemove, onReset } = props
  const { onAddVisit, onUpdateVisit, onRemoveVisit } = props
  const desktop = useMediaQuery('(min-width: 1024px)')

  const detail = selected && (
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
  )
  const list = <CountryList visitedCountries={visitedCountries} onSelect={onSelect} onSetStatus={onSetStatus} onReset={onReset} />

  if (desktop) return <div className={`${CARD} h-[420px]`}>{detail || list}</div>

  return (
    <>
      <div className={`${CARD} h-[420px]`}>{list}</div>
      {detail && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30" onClick={onBack} />
          <div role="dialog" aria-label={selected.name} className="relative max-h-[80vh] h-[80vh] bg-white rounded-t-2xl shadow-2xl">
            <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300" />
            {detail}
          </div>
        </div>
      )}
    </>
  )
}
