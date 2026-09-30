import type { ReactNode } from 'react'
import ViewSwitch, { type AppView } from './ViewSwitch'

interface AppBarProps {
  view: AppView
  onViewChange: (view: AppView) => void
  /** Centre slot: the country search (map view only). */
  search?: ReactNode
  /** Right slot: the account menu. */
  account?: ReactNode
}

/** The globe mark beside the wordmark. */
function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  )
}

/**
 * The 64px white bar across the top: MyAtlas, the Map / Timeline switch,
 * the search in the middle and the account menu on the right.
 */
export default function AppBar({ view, onViewChange, search, account }: AppBarProps) {
  return (
    <header className="relative z-30 h-16 shrink-0 flex items-center gap-3 sm:gap-5 px-4 sm:px-5 bg-white border-b border-[#D7DEE5]">
      <div className="flex items-center gap-2.5 lg:w-[180px] shrink-0">
        <Logo />
        <h1 className="hidden sm:block text-xl font-bold tracking-[-0.01em] text-[#1E293B]">MyAtlas</h1>
      </div>
      <ViewSwitch view={view} onChange={onViewChange} />
      <div className="flex-1 min-w-0 flex justify-center">{search}</div>
      {account}
    </header>
  )
}
