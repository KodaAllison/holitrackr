import type { ReactNode } from 'react'
import StatusSwatch from './StatusSwatch'

interface MapWelcomeCardProps {
  /** The card's own country search. */
  search: ReactNode
  onDismiss: () => void
}

/** First run, over the middle of the map (desktop): "Start your atlas", a search and the colour key. */
export default function MapWelcomeCard({ search, onDismiss }: MapWelcomeCardProps) {
  return (
    <section
      aria-labelledby="welcome-heading"
      className="hidden lg:flex absolute left-1/2 top-1/2 z-20 w-[460px] max-w-[calc(100%-40px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl bg-white p-7 shadow-[0_12px_40px_rgba(15,23,42,0.2)] text-[#1E293B]"
    >
      <button
        type="button"
        aria-label="Dismiss"
        title="Dismiss"
        onClick={onDismiss}
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-[#F7F9FB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6675" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      <div className="flex flex-col gap-1.5 pr-10">
        <h2 id="welcome-heading" className="text-2xl font-bold tracking-[-0.01em]">Start your atlas</h2>
        <p className="text-[15px] leading-normal text-[#475569]">
          Search for a country or click one on the map, then mark it as somewhere you&apos;ve been or somewhere you want to go.
        </p>
      </div>
      {search}
      <div className="flex gap-5 text-[13px] text-[#475569]">
        <span className="flex items-center gap-2"><StatusSwatch status="visited" />Visited</span>
        <span className="flex items-center gap-2"><StatusSwatch status="bucketlist" />Bucket list</span>
      </div>
    </section>
  )
}
