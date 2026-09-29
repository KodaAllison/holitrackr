interface MapSummaryChipProps {
  visitedCount: number
  legendOpen: boolean
  onToggleLegend: () => void
}

/** "17 of 195 countries" over the map, with the legend toggle beside it. */
export default function MapSummaryChip({ visitedCount, legendOpen, onToggleLegend }: MapSummaryChipProps) {
  return (
    <div className="hidden sm:flex absolute top-3 left-1/2 -translate-x-1/2 z-10 items-center h-10 pl-4 pr-1 gap-3 bg-white rounded-full shadow-md border border-gray-200 text-sm whitespace-nowrap">
      <span>
        <span className="font-semibold text-gray-900">{visitedCount}</span>
        <span className="text-gray-500"> of 195 countries</span>
      </span>
      <button
        type="button"
        aria-expanded={legendOpen}
        aria-controls="map-legend"
        onClick={onToggleLegend}
        className="h-8 px-3 rounded-full text-xs font-semibold text-blue-600 hover:bg-blue-50"
      >
        {legendOpen ? 'Hide legend' : 'Show legend'}
      </button>
    </div>
  )
}
