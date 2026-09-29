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
          className="absolute z-10 pointer-events-none rounded-md bg-gray-900/90 text-white text-xs font-medium px-2 py-1 whitespace-nowrap"
          style={{ left: hovered.x + 12, top: hovered.y + 12 }}
        >
          {hovered.country.name}
          {hoveredStatus && (
            <span className="ml-1 text-gray-300">· {hoveredStatus === 'visited' ? 'Visited' : 'Bucket list'}</span>
          )}
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
