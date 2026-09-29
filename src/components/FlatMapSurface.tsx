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
        className="absolute top-3 right-3 z-10 h-8 px-3 bg-white rounded-lg shadow-md border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
      >
        Fit my countries
      </button>
      {children}
    </div>
  )
}
