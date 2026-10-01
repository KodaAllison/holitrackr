import type { Ref } from 'react'

interface SelectedCountryLabelProps {
  name: string
  /** The map engine positions and shows the label through this ref (see `useSelectedLabel`). */
  labelRef: Ref<HTMLDivElement>
}

/**
 * The selected country's name beside its anchor on the map. Hidden until the
 * engine places it; aria-hidden, because the sidebar already names the country.
 */
export default function SelectedCountryLabel({ name, labelRef }: SelectedCountryLabelProps) {
  return (
    <div
      ref={labelRef}
      aria-hidden="true"
      className="invisible absolute left-0 top-0 z-[5] pointer-events-none whitespace-nowrap rounded-lg bg-[#0F172A] px-2.5 py-1 text-[13px] font-semibold leading-[18px] text-white shadow-[0_2px_6px_rgba(15,23,42,0.25)]"
    >
      {name}
    </div>
  )
}
