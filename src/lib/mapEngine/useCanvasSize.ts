import { useEffect, useRef, useState } from 'react'

/**
 * Tracks a container's CSS size and keeps its canvas backing store at
 * size × devicePixelRatio. Attach `containerRef` to a sized element and
 * `canvasRef` to a canvas filling it.
 */
export function useCanvasSize() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.round(width), height: Math.round(height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size.width * dpr)
    canvas.height = Math.round(size.height * dpr)
  }, [size])

  return { containerRef, canvasRef, size }
}

/**
 * The screen row (CSS px, relative to `canvas`) of the pointer behind a
 * d3-zoom event: the mouse or wheel, or the middle of the touches (a pinch's
 * centre). Null for a change with no pointer (a programmatic zoom).
 */
export function eventRow(source: unknown, canvas: HTMLCanvasElement): number | null {
  if (typeof TouchEvent !== 'undefined' && source instanceof TouchEvent) {
    const touches = Array.from(source.touches)
    if (touches.length === 0) return null
    const top = canvas.getBoundingClientRect().top
    return touches.reduce((sum, t) => sum + t.clientY - top, 0) / touches.length
  }
  return source instanceof MouseEvent ? source.clientY - canvas.getBoundingClientRect().top : null
}

/** The pointer's position relative to the event's target element. */
export function pointFrom(event: React.PointerEvent | React.MouseEvent): [number, number] {
  const rect = event.currentTarget.getBoundingClientRect()
  return [event.clientX - rect.left, event.clientY - rect.top]
}
