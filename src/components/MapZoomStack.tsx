interface MapZoomStackProps {
  onZoomIn: () => void
  onZoomOut: () => void
  /** Frame the marked countries; the button is left out when omitted. */
  onFit?: () => void
}

const BUTTON = 'w-11 h-11 flex items-center justify-center bg-white hover:bg-[#F7F9FB] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB]'

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

/** Desktop zoom controls, bottom-right of the map: zoom in, zoom out, fit to my countries. */
export default function MapZoomStack({ onZoomIn, onZoomOut, onFit }: MapZoomStackProps) {
  return (
    <div className="hidden lg:flex absolute bottom-5 right-5 z-10 flex-col bg-white rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.14)] divide-y divide-[#E4E9EE] overflow-hidden">
      <button type="button" aria-label="Zoom in" title="Zoom in" className={BUTTON} onClick={onZoomIn}><Icon d="M12 5v14M5 12h14" /></button>
      <button type="button" aria-label="Zoom out" title="Zoom out" className={BUTTON} onClick={onZoomOut}><Icon d="M5 12h14" /></button>
      {onFit && (
        <button type="button" aria-label="Fit to my countries" title="Fit to my countries" className={BUTTON} onClick={onFit}>
          <Icon d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </button>
      )}
    </div>
  )
}
