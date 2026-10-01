import type { MapFilter, VisitedCountry } from '../types'
import { withShown } from '../lib/mapFilter'
import StatusSwatch from './StatusSwatch'

interface MapLegendProps {
  filter: MapFilter
  onChange: (filter: MapFilter) => void
}

const OPTIONS: { status: VisitedCountry['status']; label: string }[] = [
  { status: 'visited', label: 'Visited' },
  { status: 'bucketlist', label: 'Bucket list' },
]

/**
 * Desktop "Show" filter, bottom-left of the map: the colour key doubles as
 * checkboxes that hide visited or bucket-list fills. (Mobile shows the key
 * in the summary chip.)
 */
export default function MapLegend({ filter, onChange }: MapLegendProps) {
  return (
    <fieldset className="hidden lg:flex absolute left-5 bottom-5 z-10 m-0 items-center gap-1 border-0 py-1 pl-3.5 pr-1.5 bg-white rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.14)] text-[#1E293B]">
      <legend className="float-left mr-1.5 p-0 text-[13px] font-semibold text-[#5B6675]">Show</legend>
      {OPTIONS.map(({ status, label }) => (
        <label key={status} className="h-10 px-2.5 flex items-center gap-2 rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-[#F7F9FB]">
          <input
            type="checkbox"
            checked={filter[status]}
            onChange={e => onChange(withShown(filter, status, e.target.checked))}
            className="w-4 h-4 m-0 accent-[#2563EB] cursor-pointer"
          />
          <StatusSwatch status={status} />
          {label}
        </label>
      ))}
    </fieldset>
  )
}
