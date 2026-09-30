interface TimelineButtonProps {
  onClick: () => void
}

/** Mobile: opens the Timeline from the country sheet (desktop uses the app-bar switch). */
export default function TimelineButton({ onClick }: TimelineButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 px-3 flex items-center gap-1.5 rounded-full border border-[#D7DEE5] bg-white text-[13px] font-semibold text-[#334155] hover:bg-[#F7F9FB]"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 7v5l3 2" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      Timeline
    </button>
  )
}
