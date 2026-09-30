/** While the session is checked: the ocean backdrop with a "Loading" pill. */
export default function LoadingScreen() {
  return (
    <div aria-busy="true" className="min-h-[100dvh] bg-[#DCE6EE] flex items-center justify-center">
      <div role="status" className="h-12 px-[18px] flex items-center gap-3 bg-white rounded-full shadow-[0_2px_10px_rgba(15,23,42,0.14)] text-sm text-[#334155]">
        <svg className="animate-spin motion-reduce:animate-none" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-9-9" />
        </svg>
        Loading your atlas…
      </div>
    </div>
  )
}
