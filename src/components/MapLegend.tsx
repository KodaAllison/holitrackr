/** Key for the map's status colours (see src/lib/mapEngine/palette.ts). */
export default function MapLegend() {
  return (
    <div className="flex gap-4 px-3 py-2 border-t border-gray-100 text-xs sm:block sm:space-y-1 sm:absolute sm:bottom-4 sm:left-4 sm:z-10 sm:bg-white sm:rounded-lg sm:shadow-md sm:border sm:border-gray-200 pointer-events-none">
      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#0B7A53] inline-block" /> Visited</div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full inline-block border border-[#9A5B00] bg-[repeating-linear-gradient(135deg,#F2B24E_0_2px,#C27A0A_2px_3px)]" /> Bucket List
      </div>
      <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block bg-[#F7F8F9] border border-[#B4C0CC]" /> Not visited</div>
    </div>
  )
}
