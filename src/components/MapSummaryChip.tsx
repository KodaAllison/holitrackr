import { TOTAL_CONTINENTS, TOTAL_COUNTRIES, type AtlasProgress } from '../lib/atlasProgress'
import StatusSwatch from './StatusSwatch'

interface MapSummaryChipProps {
  progress: AtlasProgress
  /** While the countries load, desktop shows a grey placeholder instead. */
  loading?: boolean
}

const CHIP = 'flex items-center bg-white rounded-full shadow-[0_1px_3px_rgba(15,23,42,0.14)] whitespace-nowrap text-[#1E293B]'
const DIVIDER = <span aria-hidden="true" className="w-px bg-[#D7DEE5] h-3.5 lg:h-[18px]" />

/**
 * How much of the world you've seen, over the map. Desktop: a progress bar,
 * "18 of 195 countries" and "5 of 7 continents". Mobile: the count and the
 * colour key, under the floating search.
 */
export default function MapSummaryChip({ progress, loading }: MapSummaryChipProps) {
  return (
    <>
      {loading && <div aria-hidden="true" className="hidden lg:block w-[300px] h-11 rounded-full bg-white/70 animate-pulse" />}
      <div className={`${CHIP} ${loading ? 'hidden' : 'hidden lg:flex'} h-11 px-4 gap-3 text-sm`}>
        <div
          role="progressbar"
          aria-label="Share of the world visited"
          aria-valuemin={0}
          aria-valuemax={TOTAL_COUNTRIES}
          aria-valuenow={progress.countries}
          className="w-20 h-1.5 rounded-full bg-[#E4E9EE] overflow-hidden"
        >
          <div className="h-full bg-[#0B7A53]" style={{ width: `${progress.share * 100}%` }} />
        </div>
        <span><strong>{progress.countries}</strong> <span className="text-[#5B6675]">of {TOTAL_COUNTRIES} countries</span></span>
        {progress.countries > 0 && (
          <>
            {DIVIDER}
            <span><strong>{progress.continents}</strong> <span className="text-[#5B6675]">of {TOTAL_CONTINENTS} continents</span></span>
          </>
        )}
      </div>
      <div className={`${CHIP} lg:hidden absolute left-4 top-[72px] z-10 h-9 px-3 gap-2.5 text-[13px]`}>
        <span><strong>{progress.countries}</strong> <span className="text-[#5B6675]">of {TOTAL_COUNTRIES}</span></span>
        {DIVIDER}
        <span className="flex items-center gap-[5px]"><StatusSwatch status="visited" small />Visited</span>
        <span className="flex items-center gap-[5px]"><StatusSwatch status="bucketlist" small />Bucket list</span>
      </div>
    </>
  )
}
