import type { Country, VisitedCountry } from '../types'

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
  statusOf: (country: Country) => Status | undefined
}

const STATUS_LINE: Record<Status, string> = {
  visited: 'Visited · click for details',
  bucketlist: 'Bucket list · click for details',
}

/** The HTML layered over the map canvas: the loading state and the hover tooltip. */
export default function MapOverlays({ loading, failed, hovered, statusOf }: MapOverlaysProps) {
  const status = hovered && statusOf(hovered.country)
  return (
    <>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-[#5B6675]">
          {failed ? 'The map could not be loaded.' : 'Loading map...'}
        </div>
      )}
      {hovered && (
        <div
          role="tooltip"
          className="absolute z-20 pointer-events-none flex flex-col gap-0.5 rounded-lg bg-[#0F172A] px-3 py-2 text-white shadow-[0_4px_12px_rgba(15,23,42,0.25)] whitespace-nowrap"
          style={{ left: hovered.x + 14, top: hovered.y + 14 }}
        >
          <span className="text-sm font-semibold">{hovered.country.name}</span>
          <span className="text-[13px] text-[#CBD5E1]">{status ? STATUS_LINE[status] : 'Not marked yet · click to open'}</span>
        </div>
      )}
    </>
  )
}
