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

/** Segmented Globe / Flat map control, top-left of the map. */
export default function MapViewToggle({ view, disabled, onChange }: MapViewToggleProps) {
  return (
    <div role="group" aria-label="Map view" className="absolute top-3 left-3 z-10 flex p-1 gap-1 bg-white rounded-lg shadow-md border border-gray-200">
      {OPTIONS.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={view === option.value}
          disabled={disabled}
          onClick={() => view !== option.value && onChange(option.value)}
          className={`h-8 px-3 rounded-md text-sm font-semibold transition-colors ${
            view === option.value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
