import type { ReactNode } from 'react'
import { useGlobeMap, type GlobeMapOptions } from '../lib/mapEngine/useGlobeMap'
import MapZoomStack from './MapZoomStack'

interface GlobeMapSurfaceProps {
  options: GlobeMapOptions
  className: string
  /** Show "Fit to my countries" (there are countries to fit). */
  canFit?: boolean
  children?: ReactNode
}

/** The spinnable globe canvas, its zoom stack, and the parent's overlays. */
export default function GlobeMapSurface({ options, className, canFit, children }: GlobeMapSurfaceProps) {
  const { containerRef, canvasRef, handlers, zoomBy, fitMine } = useGlobeMap(options)
  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full touch-none cursor-grab" {...handlers} />
      <MapZoomStack onZoomIn={() => zoomBy(1.5)} onZoomOut={() => zoomBy(1 / 1.5)} onFit={canFit ? fitMine : undefined} />
      {children}
    </div>
  )
}
