import type { Country, VisitedCountry } from '../types'
import MapPopup from './MapPopup'

type Status = VisitedCountry['status']

export interface Pointed {
  country: Country
  x: number
  y: number
}

interface MapOverlaysProps {
  loading: boolean
  failed: boolean
  hovered: Pointed | null
  popup: Pointed | null
  statusOf: (country: Country) => Status | undefined
  containerWidth: number
  onAction: (country: Country, status: Status) => void
  onOpenJournal?: (country: Country) => void
  onClose: () => void
}

/** The HTML layered over the map canvas: loading state, hover tooltip, popup. */
export default function MapOverlays({
  loading, failed, hovered, popup, statusOf, containerWidth, onAction, onOpenJournal, onClose,
}: MapOverlaysProps) {
  const hoveredStatus = hovered && statusOf(hovered.country)
  return (
    <>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-600">
          {failed ? 'The map could not be loaded.' : 'Loading map...'}
        </div>
      )}
      {hovered && !popup && (
        <div
          className="absolute z-20 pointer-events-none rounded-lg bg-white shadow-lg border border-gray-200 px-3 py-2 whitespace-nowrap"
          style={{ left: hovered.x + 14, top: hovered.y + 14 }}
        >
          <p className="text-sm font-semibold text-gray-900">{hovered.country.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
            <span
              className={`w-2 h-2 rounded-full ${
                hoveredStatus === 'visited' ? 'bg-[#0B7A53]'
                  : hoveredStatus === 'bucketlist' ? 'bg-[#F2B24E] ring-1 ring-[#9A5B00]'
                  : 'bg-[#F7F8F9] ring-1 ring-[#B4C0CC]'
              }`}
            />
            {hoveredStatus === 'visited' ? 'Visited' : hoveredStatus === 'bucketlist' ? 'On your bucket list' : 'Not visited yet · click to mark'}
          </p>
        </div>
      )}
      {popup && (
        <MapPopup
          country={popup.country}
          status={statusOf(popup.country)}
          x={popup.x}
          y={popup.y}
          containerWidth={containerWidth}
          onAction={status => onAction(popup.country, status)}
          onOpenJournal={onOpenJournal && (() => onOpenJournal(popup.country))}
          onClose={onClose}
        />
      )}
    </>
  )
}
