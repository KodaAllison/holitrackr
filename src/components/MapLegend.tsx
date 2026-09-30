import StatusSwatch from './StatusSwatch'

/** Desktop key for the map colours, bottom-left of the map. (Mobile shows it in the summary chip.) */
export default function MapLegend() {
  return (
    <div
      aria-label="Map key"
      className="hidden lg:flex absolute left-5 bottom-5 z-10 h-11 items-center gap-5 px-4 bg-white rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.14)] text-[13px] font-semibold text-[#1E293B] pointer-events-none"
    >
      <span className="flex items-center gap-2"><StatusSwatch status="visited" />Visited</span>
      <span className="flex items-center gap-2"><StatusSwatch status="bucketlist" />Bucket list</span>
    </div>
  )
}
