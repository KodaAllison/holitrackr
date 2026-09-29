import { useEffect } from 'react'
import type { Country, VisitedCountry } from '../types'

interface MapPopupProps {
  country: Country
  status?: VisitedCountry['status']
  x: number
  y: number
  containerWidth: number
  onAction: (status: VisitedCountry['status']) => void
  onOpenJournal?: () => void
  onClose: () => void
}

const WIDTH = 188

/** Status actions for a clicked country, anchored above the click point. */
export default function MapPopup({
  country, status, x, y, containerWidth, onAction, onOpenJournal, onClose,
}: MapPopupProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const left = Math.min(Math.max(x - WIDTH / 2, 8), Math.max(8, containerWidth - WIDTH - 8))
  const above = y > 150

  return (
    <div
      role="dialog"
      aria-label={country.name}
      className="absolute z-20 bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-sm"
      style={{ left, top: above ? y - 12 : y + 12, width: WIDTH, transform: above ? 'translateY(-100%)' : undefined }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-gray-800">{country.name}</p>
        <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 leading-none">×</button>
      </div>
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => onAction('visited')}
          className={`flex-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${
            status === 'visited'
              ? 'bg-[#0B7A53] text-white border-[#0B7A53]'
              : 'border-[#0B7A53] text-[#0B7A53] hover:bg-emerald-50'
          }`}
        >Visited</button>
        <button
          onClick={() => onAction('bucketlist')}
          className={`flex-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${
            status === 'bucketlist'
              ? 'bg-[#F2B24E] text-[#5C3700] border-[#9A5B00]'
              : 'border-[#9A5B00] text-[#9A5B00] hover:bg-amber-50'
          }`}
        >Bucket List</button>
      </div>
      {status && onOpenJournal && (
        <button
          onClick={onOpenJournal}
          className="w-full px-2 py-1 rounded text-xs font-medium border border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors"
        >
          Edit Journal
        </button>
      )}
    </div>
  )
}
