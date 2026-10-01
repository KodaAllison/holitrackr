interface AtlasLoadErrorProps {
  onRetry: () => void
}

/**
 * Over the map when the user's countries could not be loaded, so a failed
 * load never looks like an empty atlas: "Couldn't load your atlas." with Retry.
 */
export default function AtlasLoadError({ onRetry }: AtlasLoadErrorProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#DCE6EE]/70 px-4 backdrop-blur-[2px]">
      <div role="alert" className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-white px-6 py-5 text-center shadow-[0_8px_30px_rgba(15,23,42,0.16)]">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B42318" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
        </svg>
        <p className="text-[15px] font-semibold text-[#1E293B]">Couldn't load your atlas.</p>
        <p className="text-sm text-[#5B6675]">Check your connection and try again.</p>
        <button
          type="button"
          onClick={onRetry}
          className="h-11 rounded-xl bg-[#2563EB] px-5 text-[15px] font-semibold text-white hover:bg-[#1D4ED8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
