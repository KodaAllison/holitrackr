import { useEffect, useState } from 'react'
import type { MapFilter } from '../types'
import StatusSwatch from './StatusSwatch'

interface MobileMapControlsProps {
  onFit: () => void
  filter: MapFilter
  onFilterChange?: (filter: MapFilter) => void
}

const BUTTON = 'flex h-11 w-11 items-center justify-center bg-white hover:bg-[#F7F9FB] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB]'
const ICON = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: '#1E293B', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

/**
 * Below `lg`: the white stack on the map's right edge, "Fit to my countries"
 * and "Map filters", which opens Visited / Bucket list checkboxes.
 */
export default function MobileMapControls({ onFit, filter, onFilterChange }: MobileMapControlsProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const options: { key: keyof MapFilter; label: string }[] = [
    { key: 'visited', label: 'Visited' },
    { key: 'bucketlist', label: 'Bucket list' },
  ]

  return (
    <div className="absolute right-4 top-[120px] z-10 lg:hidden">
      <div className="flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.14)]">
        <button type="button" aria-label="Fit to my countries" title="Fit to my countries" onClick={onFit} className={BUTTON}>
          <svg {...ICON}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        </button>
        <div aria-hidden="true" className="h-px bg-[#E4E9EE]" />
        {onFilterChange && (
          <button
            type="button"
            aria-label="Map filters"
            aria-expanded={open}
            aria-controls="map-filters"
            onClick={() => setOpen(o => !o)}
            className={`${BUTTON} ${open ? 'bg-[#EFF6FF]' : ''}`}
          >
            <svg {...ICON}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></svg>
          </button>
        )}
      </div>
      {open && onFilterChange && (
        <>
          <button type="button" aria-label="Close map filters" tabIndex={-1} className="fixed inset-0 -z-10 cursor-default" onClick={() => setOpen(false)} />
          <fieldset
            id="map-filters"
            className="absolute right-0 top-full mt-2 w-44 rounded-xl bg-white px-3 py-1.5 shadow-[0_12px_40px_rgba(15,23,42,0.2)]"
          >
            <legend className="sr-only">Show on the map</legend>
            <p aria-hidden="true" className="pb-0.5 pt-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#5B6675]">Show</p>
            {options.map(o => (
              <label key={o.key} className="flex h-11 items-center gap-2.5 text-[13px] font-semibold text-[#1E293B]">
                <input
                  type="checkbox"
                  checked={filter[o.key]}
                  onChange={e => onFilterChange({ ...filter, [o.key]: e.target.checked })}
                  className="h-4 w-4 accent-[#2563EB]"
                />
                <StatusSwatch status={o.key} />
                {o.label}
              </label>
            ))}
          </fieldset>
        </>
      )}
    </div>
  )
}
