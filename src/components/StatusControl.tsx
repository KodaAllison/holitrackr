import type { VisitedCountry } from '../types'

type Status = VisitedCountry['status']

interface StatusControlProps {
  status: Status
  onSetStatus: (status: Status) => void
  onRemove: () => void
  /** Mobile sheet: 48px buttons, radius 12, 15px text, 8px gaps. */
  large?: boolean
}

const BASE = 'flex items-center justify-center gap-1.5 whitespace-nowrap border-[1.5px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1'

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

/** The detail panel's Visited / Bucket list / Remove buttons (FEATURES #9). */
export default function StatusControl({ status, onSetStatus, onRemove, large }: StatusControlProps) {
  const visited = status === 'visited'
  const BUTTON = `${BASE} ${large ? 'h-12 rounded-xl text-[15px]' : 'h-11 rounded-[10px] text-sm'}`
  return (
    <div role="group" aria-label="Status" className={`grid grid-cols-3 ${large ? 'gap-2' : 'gap-1.5'}`}>
      <button
        type="button"
        aria-pressed={visited}
        onClick={() => { if (!visited) onSetStatus('visited') }}
        className={`${BUTTON} ${visited ? 'border-[#0B7A53] bg-[#0B7A53] text-white' : 'border-[#7FBFA6] bg-white text-[#0B7A53] hover:bg-[#F0F8F4]'}`}
      >
        {visited && <Check />}Visited
      </button>
      <button
        type="button"
        aria-pressed={!visited}
        onClick={() => { if (visited) onSetStatus('bucketlist') }}
        className={`${BUTTON} ${!visited ? 'border-[#9A5B00] bg-[#FDF1DB] text-[#7A4800]' : 'border-[#D9A650] bg-white text-[#8A5A0B] hover:bg-[#FFFBF2]'}`}
      >
        {!visited && <Check />}Bucket list
      </button>
      <button type="button" onClick={onRemove} className={`${BUTTON} border-[#D7DEE5] bg-white font-medium text-[#B42318] hover:bg-[#FEF3F2]`}>
        Remove
      </button>
    </div>
  )
}
