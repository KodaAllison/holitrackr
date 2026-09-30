import type { ReactNode } from 'react'
import { useGlobeMap, type GlobeMapOptions } from '../lib/mapEngine/useGlobeMap'

interface GlobeMapSurfaceProps {
  options: GlobeMapOptions
  className: string
  children?: ReactNode
}

const zoomButton = 'w-11 h-11 flex items-center justify-center text-[#1E293B] hover:bg-[#F7F9FB] text-xl leading-none'

/** The spinnable globe canvas, its zoom buttons, and the parent's overlays. */
export default function GlobeMapSurface({ options, className, children }: GlobeMapSurfaceProps) {
  const { containerRef, canvasRef, handlers, zoomBy } = useGlobeMap(options)
  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full touch-none cursor-grab" {...handlers} />
      <div className="absolute bottom-5 right-5 z-10 flex flex-col bg-white rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.14)] divide-y divide-[#E4E9EE] overflow-hidden">
        <button type="button" aria-label="Zoom in" className={zoomButton} onClick={() => zoomBy(1.5)}>+</button>
        <button type="button" aria-label="Zoom out" className={zoomButton} onClick={() => zoomBy(1 / 1.5)}>−</button>
      </div>
      {children}
    </div>
  )
}
