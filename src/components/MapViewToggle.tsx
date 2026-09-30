export type MapView = 'globe' | 'flat'

interface MapViewToggleProps {
  view: MapView
  disabled?: boolean
  onChange: (view: MapView) => void
}

const OPTIONS: { value: MapView; label: string }[] = [
  { value: 'globe', label: 'Globe' },
  { value: 'flat', label: 'Flat map' },
]

/** Segmented Globe / Flat map control, top-left of the map (the parent positions it). */
export default function MapViewToggle({ view, disabled, onChange }: MapViewToggleProps) {
  return (
    <div role="group" aria-label="Map view" className="flex p-1 gap-1 bg-white rounded-[10px] shadow-[0_1px_3px_rgba(15,23,42,0.15)]">
      {OPTIONS.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={view === option.value}
          disabled={disabled}
          onClick={() => view !== option.value && onChange(option.value)}
          className={`h-9 px-3.5 rounded-[7px] text-sm font-semibold transition-colors ${
            view === option.value ? 'bg-[#EEF2F6] text-[#1E293B]' : 'text-[#5B6675] hover:text-[#1E293B]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
