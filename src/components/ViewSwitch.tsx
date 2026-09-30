export type AppView = 'map' | 'timeline'

interface ViewSwitchProps {
  view: AppView
  onChange: (view: AppView) => void
}

const OPTIONS: { value: AppView; label: string }[] = [
  { value: 'map', label: 'Map' },
  { value: 'timeline', label: 'Timeline' },
]

/** The Map / Timeline segmented control in the app bar. */
export default function ViewSwitch({ view, onChange }: ViewSwitchProps) {
  return (
    <nav aria-label="View" className="flex shrink-0 p-1 gap-1 bg-[#EEF2F6] rounded-[10px]">
      {OPTIONS.map(option => {
        const active = view === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => !active && onChange(option.value)}
            className={`h-9 px-4 rounded-[7px] text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              active
                ? 'bg-white font-semibold text-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.12)]'
                : 'font-medium text-[#5B6675] hover:text-[#1E293B]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </nav>
  )
}
