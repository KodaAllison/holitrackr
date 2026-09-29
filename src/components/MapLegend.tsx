interface MapLegendProps {
  /** Visited-country count for the summary. */
  visitedCount: number
  /** Desktop: whether the legend panel is shown (the summary chip toggles it). */
  open: boolean
}

const TOTAL = 195

function Swatches() {
  return (
    <>
      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#0B7A53] inline-block" /> Visited</div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full inline-block border border-[#9A5B00] bg-[repeating-linear-gradient(135deg,#F2B24E_0_2px,#C27A0A_2px_3px)]" /> Bucket list
      </div>
      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block bg-[#F7F8F9] border border-[#B4C0CC]" /> Not visited</div>
    </>
  )
}

/**
 * Key for the map's status colours. On small screens it is a row under the
 * map (with the summary count); on larger screens a panel over the map,
 * shown or hidden from the summary chip.
 */
export default function MapLegend({ visitedCount, open }: MapLegendProps) {
  return (
    <>
      <div className="sm:hidden flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 border-t border-gray-100 text-xs">
        <span className="font-semibold text-gray-800">{visitedCount} of {TOTAL}</span>
        <Swatches />
      </div>
      {open && (
        <div id="map-legend" className="hidden sm:block absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-md border border-gray-200 px-3 py-2 text-xs space-y-1 pointer-events-none">
          <Swatches />
        </div>
      )}
    </>
  )
}
