import { useEffect, useRef, useState } from 'react'
import { LIST_SORTS, type ListSort } from '../lib/countryListModel'

interface SortMenuProps {
  value: ListSort
  onChange: (sort: ListSort) => void
}

/** "Sort: Continent ⌄": a small menu of list orders. */
export default function SortMenu({ value, onChange }: SortMenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const label = LIST_SORTS.find(s => s.value === value)?.label ?? 'Continent'

  // Close on an outside click.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (root.current && e.target instanceof Node && !root.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      root.current?.querySelector('button')?.focus()
    }
  }

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D7DEE5] bg-white px-2.5 text-[13px] text-[#334155] hover:bg-[#F7F9FB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
      >
        {/* Narrow sheets (beside the mobile Timeline button) drop the visible prefix. */}
        <span className="sr-only sm:not-sr-only">Sort: </span>{label}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B6675" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div role="menu" aria-label="Sort countries by" className="absolute right-0 top-10 z-20 w-40 rounded-lg border border-[#D7DEE5] bg-white py-1 shadow-lg">
          {LIST_SORTS.map(s => (
            <button
              key={s.value}
              type="button"
              role="menuitemradio"
              aria-checked={s.value === value}
              autoFocus={s.value === value}
              onClick={() => { onChange(s.value); setOpen(false) }}
              className="flex h-9 w-full items-center justify-between px-3 text-left text-sm text-[#1E293B] hover:bg-[#F5F8FF] focus:bg-[#F5F8FF] focus:outline-none"
            >
              {s.label}
              {s.value === value && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
