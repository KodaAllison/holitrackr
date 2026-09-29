import type { ReactNode } from 'react'
import { useGlobeMap, type GlobeMapOptions } from '../lib/mapEngine/useGlobeMap'

interface GlobeMapSurfaceProps {
  options: GlobeMapOptions
  className: string
  children?: ReactNode
}

const zoomButton = 'w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-50 text-lg leading-none'

/** The spinnable globe canvas, its zoom buttons, and the parent's overlays. */
export default function GlobeMapSurface({ options, className, children }: GlobeMapSurfaceProps) {
  const { containerRef, canvasRef, handlers, zoomBy } = useGlobeMap(options)
  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full touch-none cursor-grab" {...handlers} />
      <div className="absolute top-3 right-3 z-10 flex flex-col bg-white rounded-lg shadow-md border border-gray-200 divide-y divide-gray-200 overflow-hidden">
        <button type="button" aria-label="Zoom in" className={zoomButton} onClick={() => zoomBy(1.5)}>+</button>
        <button type="button" aria-label="Zoom out" className={zoomButton} onClick={() => zoomBy(1 / 1.5)}>−</button>
      </div>
      {children}
    </div>
  )
}
