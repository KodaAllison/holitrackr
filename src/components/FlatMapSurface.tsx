import type { ReactNode } from 'react'
import { useFlatMap, type MapViewOptions } from '../lib/mapEngine/useFlatMap'

interface FlatMapSurfaceProps {
  options: MapViewOptions
  className: string
  children?: ReactNode
}

/** The flat map canvas plus whatever overlays the parent positions on it. */
export default function FlatMapSurface({ options, className, children }: FlatMapSurfaceProps) {
  const { containerRef, canvasRef, handlers } = useFlatMap(options)
  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full touch-none" {...handlers} />
      {children}
    </div>
  )
}
