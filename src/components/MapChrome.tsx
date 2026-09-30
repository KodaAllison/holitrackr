import type { MapFilter } from '../types'
import type { AtlasProgress } from '../lib/atlasProgress'
import MapLegend from './MapLegend'
import MapSummaryChip from './MapSummaryChip'
import MapViewToggle, { type MapView } from './MapViewToggle'

interface MapChromeProps {
  desktop: boolean
  view: MapView
  /** The globe ⇄ flat unroll is playing. */
  morphing: boolean
  onViewChange: (view: MapView) => void
  progress: AtlasProgress
  loading?: boolean
  /** A country is open: top-left becomes "‹ World view". */
  selected: boolean
  onWorldView: () => void
  filter: MapFilter
  onFilterChange: (filter: MapFilter) => void
  showLegend: boolean
  /** The centred how-to line, or null to hide it. */
  hint: string | null
}

/**
 * The controls over the map (not the zoom stack, which each surface owns):
 * Globe / Flat and the summary pill top-left, or "‹ World view" while a
 * country is open; the "Show" filter bottom-left; the hint bottom-centre.
 */
export default function MapChrome(props: MapChromeProps) {
  const { desktop, view, morphing, onViewChange, progress, loading, selected, onWorldView } = props
  const { filter, onFilterChange, showLegend, hint } = props
  return (
    <>
      {desktop && selected ? (
        <button
          type="button"
          onClick={onWorldView}
          className="absolute top-5 left-5 z-10 h-11 pl-3 pr-4 flex items-center gap-2 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.14)] text-sm font-semibold text-[#1E293B] hover:bg-[#F7F9FB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          World view
        </button>
      ) : (
        // Desktop: Globe / Flat and the summary, top-left. Mobile: the chip places itself under the search.
        <div className="lg:absolute lg:top-5 lg:left-5 lg:z-10 flex items-center gap-2">
          {desktop && <MapViewToggle view={view} disabled={morphing} onChange={onViewChange} />}
          <MapSummaryChip progress={progress} loading={loading} />
        </div>
      )}
      {showLegend && <MapLegend filter={filter} onChange={onFilterChange} />}
      {hint && (
        <p className="hidden lg:block absolute inset-x-0 bottom-6 z-10 text-center pointer-events-none">
          <span className="inline-block px-3 py-1.5 rounded-full bg-white/85 text-[13px] text-[#475569]">{hint}</span>
        </p>
      )}
    </>
  )
}
