const KEYS: [string, string][] = [
  ['↑↓', 'move'],
  ['Enter', 'open'],
  ['Esc', 'close'],
]

/** The sidebar's footer strip of keyboard shortcuts (desktop only). */
export default function KeyboardLegend() {
  return (
    <div className="hidden shrink-0 gap-3.5 border-t border-[#E4E9EE] px-5 pb-3.5 pt-2.5 text-[13px] text-[#5B6675] lg:flex">
      {KEYS.map(([key, action]) => (
        <span key={key}>
          <kbd className="rounded-[5px] border border-[#D7DEE5] px-1.5 py-px font-[inherit] text-[#1E293B]">{key}</kbd> {action}
        </span>
      ))}
    </div>
  )
}
