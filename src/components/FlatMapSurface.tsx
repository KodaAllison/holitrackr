import type { ReactNode } from 'react'
import { useFlatMap, type FlatMapOptions } from '../lib/mapEngine/useFlatMap'

interface FlatMapSurfaceProps {
  options: FlatMapOptions
  className: string
  children?: ReactNode
}

/** The flat map canvas, a "Fit my countries" button, and the parent's overlays. */
export default function FlatMapSurface({ options, className, children }: FlatMapSurfaceProps) {
  const { containerRef, canvasRef, handlers, fitMine } = useFlatMap(options)
  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full touch-none" {...handlers} />
      <button
        type="button"
        onClick={fitMine}
        className="absolute top-[120px] right-4 lg:top-auto lg:bottom-5 lg:right-5 z-10 h-9 lg:h-11 px-3 lg:px-4 bg-white rounded-full lg:rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.14)] text-[13px] font-semibold text-[#1E293B] hover:bg-[#F7F9FB]"
      >
        Fit my countries
      </button>
      {children}
    </div>
  )
}
