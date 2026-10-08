import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { clampSheetHeight, expandedHeight, isTap, SHEET_HEIGHT_VAR, snapExpanded } from '../lib/mobileSheet'
import { inertOthers } from '../lib/usePanelFocus'

interface MobileSheetProps {
  label: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  /** Collapsed height in px; omitted, the collapsed sheet fits its content. */
  collapsedHeight?: number
  /**
   * A modal dialog (see `sheetIsModal`): the rest of the page, bar the
   * toasts, is inert and focus moves in. Escape is the panel's own.
   */
  modal?: boolean
  children: ReactNode
}

interface Drag {
  pointerId: number
  startY: number
  startHeight: number
  collapsed: number
  expanded: number
  lastY: number
  lastT: number
  velocity: number
  moved: boolean
}

/**
 * Below `lg`: a sheet over the bottom of the map. Drag its handle to resize
 * (it snaps collapsed or expanded) or tap it to toggle. The height eases
 * between snaps unless the viewer prefers reduced motion. Its current
 * height (while dragging and easing too) is published as the
 * `--sheet-height` CSS variable on <html>, so the `ToastStack` can sit
 * just above it. Collapsed, or showing the list, it is a plain region and
 * the map stays usable; `modal`, it is a dialog over an inert page.
 */
export default function MobileSheet({ label, expanded, onExpandedChange, collapsedHeight, modal, children }: MobileSheetProps) {
  const sheet = useRef<HTMLElement>(null)
  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const [dragHeight, setDragHeight] = useState<number | null>(null)

  useEffect(() => {
    const el = sheet.current
    const root = document.documentElement
    if (!el) return
    const publish = () => root.style.setProperty(SHEET_HEIGHT_VAR, `${Math.round(el.getBoundingClientRect().height)}px`)
    publish()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish)
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      root.style.removeProperty(SHEET_HEIGHT_VAR)
    }
  }, [])

  // Modal: the page behind goes inert, and focus moves in if it is outside
  // (to the panel's heading, else the handle). A layout effect, so the
  // inert is undone before the sidebar returns focus on close.
  useLayoutEffect(() => {
    const el = sheet.current
    if (!modal || !el) return
    const restore = inertOthers(el)
    if (!el.contains(document.activeElement)) {
      const target = el.querySelector<HTMLElement>('h2[tabindex="-1"]') ?? el.querySelector<HTMLElement>('button')
      target?.focus({ preventScroll: true })
    }
    return restore
  }, [modal])

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = sheet.current
    if (!el) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const startHeight = el.getBoundingClientRect().height
    drag.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeight,
      // An auto-height sheet collapses back to whatever it measures now.
      collapsed: expanded ? (collapsedHeight ?? 0) : (collapsedHeight ?? startHeight),
      expanded: expandedHeight(window.innerHeight),
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      moved: false,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dy = d.startY - e.clientY
    if (!d.moved && isTap(dy)) return
    d.moved = true
    const dt = Math.max(1, e.timeStamp - d.lastT)
    d.velocity = (d.lastY - e.clientY) / dt
    d.lastY = e.clientY
    d.lastT = e.timeStamp
    setDragHeight(clampSheetHeight(d.startHeight + dy, d.collapsed || 120, d.expanded))
  }

  const onPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = null
    if (!d.moved) return // a tap: onClick toggles
    suppressClick.current = true
    const height = clampSheetHeight(d.startHeight + d.startY - e.clientY, d.collapsed || 120, d.expanded)
    setDragHeight(null)
    const next = snapExpanded({ height, velocity: d.velocity, collapsed: d.collapsed || 120, expanded: d.expanded })
    if (next !== expanded) onExpandedChange(next)
  }

  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    onExpandedChange(!expanded)
  }

  const height = dragHeight !== null ? `${dragHeight}px`
    : expanded ? `calc(100dvh - 88px)`
    : collapsedHeight !== undefined ? `${collapsedHeight}px` : undefined

  return (
    <section
      ref={sheet}
      aria-label={label}
      role={modal ? 'dialog' : undefined}
      aria-modal={modal ? true : undefined}
      style={{ height }}
      className={`absolute inset-x-0 bottom-0 z-30 flex max-h-[calc(100dvh-88px)] flex-col overflow-hidden rounded-t-[20px] bg-white shadow-[0_-8px_30px_rgba(15,23,42,0.16)] ${
        dragHeight === null ? 'transition-[height] duration-300 ease-out motion-reduce:transition-none' : ''
      }`}
    >
      <button
        type="button"
        aria-label={expanded ? 'Collapse' : 'Expand'}
        aria-expanded={expanded}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={onClick}
        className="flex h-8 w-full shrink-0 touch-none items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB]"
      >
        <span aria-hidden="true" className="h-[5px] w-10 rounded-full bg-[#C7D0D9]" />
      </button>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}
