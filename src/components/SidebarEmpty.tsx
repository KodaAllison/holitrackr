/** First run: nothing marked yet. */
export default function SidebarEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-11 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" />
        <path d="M9 4v14M15 6v14" />
      </svg>
      <p className="text-[15px] font-semibold text-[#1E293B]">Nothing here yet</p>
      <p className="text-sm leading-normal text-[#5B6675]">
        Countries you mark appear here, grouped by continent, with space for dates, ratings and notes.
      </p>
    </div>
  )
}
