interface MobileBackButtonProps {
  onClick: () => void
}

/** Below `lg`, with a country selected: the round "‹" before the floating search, back to all countries. */
export default function MobileBackButton({ onClick }: MobileBackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back to all countries"
      className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </button>
  )
}
