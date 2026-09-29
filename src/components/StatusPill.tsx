import type { VisitedCountry } from '../types'

type Status = VisitedCountry['status']

interface StatusPillProps {
  status: Status
  name: string
  onToggle: (next: Status) => void
}

/** "Visited" / "Bucket list" pill; clicking flips the status (FEATURES #9). */
export default function StatusPill({ status, name, onToggle }: StatusPillProps) {
  const next: Status = status === 'visited' ? 'bucketlist' : 'visited'
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onToggle(next) }}
      aria-label={`${name}: ${status === 'visited' ? 'visited' : 'on bucket list'}. Switch to ${next === 'visited' ? 'visited' : 'bucket list'}`}
      className={`shrink-0 h-6 px-2.5 rounded-full text-[11px] font-semibold border transition-colors ${
        status === 'visited'
          ? 'bg-[#0B7A53] border-[#0B7A53] text-white hover:bg-[#096645]'
          : 'bg-[#F2B24E]/30 border-[#9A5B00] text-[#7A4800] hover:bg-[#F2B24E]/50'
      }`}
    >
      {status === 'visited' ? 'Visited' : 'Bucket list'}
    </button>
  )
}
