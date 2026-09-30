import type { ReactNode } from 'react'
import { useFlatMap, type FlatMapOptions } from '../lib/mapEngine/useFlatMap'
import MapZoomStack from './MapZoomStack'

interface FlatMapSurfaceProps {
  options: FlatMapOptions
  className: string
  /** Show "Fit to my countries" (there are countries to fit). */
  canFit?: boolean
  children?: ReactNode
}

/** The flat map canvas, its zoom controls, and the parent's overlays. */
export default function FlatMapSurface({ options, className, canFit, children }: FlatMapSurfaceProps) {
  const { containerRef, canvasRef, handlers, fitMine, zoomBy } = useFlatMap(options)
  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full touch-none" {...handlers} />
      {/* Mobile: a text button under the floating search. Desktop: the zoom stack. */}
      <button
        type="button"
        onClick={fitMine}
        className="lg:hidden absolute top-[120px] right-4 z-10 h-9 px-3 bg-white rounded-full shadow-[0_1px_3px_rgba(15,23,42,0.14)] text-[13px] font-semibold text-[#1E293B] hover:bg-[#F7F9FB]"
      >
        Fit my countries
      </button>
      <MapZoomStack onZoomIn={() => zoomBy(1.5)} onZoomOut={() => zoomBy(1 / 1.5)} onFit={canFit ? fitMine : undefined} />
      {children}
    </div>
  )
}
