import type { ReactNode } from 'react'
import { useFlatMap, type FlatMapOptions } from '../lib/mapEngine/useFlatMap'
import MapZoomStack from './MapZoomStack'

interface FlatMapSurfaceProps {
  options: FlatMapOptions
  className: string
  /** Show "Fit to my countries" in the desktop zoom stack (there are countries to fit). */
  canFit?: boolean
  children?: ReactNode
  /** Extra controls that need the fit action (the mobile map's right-hand stack). */
  controls?: (fitMine: () => void) => ReactNode
}

/** The flat map canvas, its zoom controls (desktop stack, or the parent's `controls`), and the parent's overlays. */
export default function FlatMapSurface({ options, className, canFit, children, controls }: FlatMapSurfaceProps) {
  const { containerRef, canvasRef, handlers, fitMine, zoomBy } = useFlatMap(options)
  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full touch-none" {...handlers} />
      <MapZoomStack onZoomIn={() => zoomBy(1.5)} onZoomOut={() => zoomBy(1 / 1.5)} onFit={canFit ? fitMine : undefined} />
      {controls?.(fitMine)}
      {children}
    </div>
  )
}
