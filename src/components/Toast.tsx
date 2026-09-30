import { useEffect } from 'react'

interface ToastProps {
  message: string
  /** Optional action, e.g. Undo. */
  action?: { label: string; onClick: () => void }
  onDismiss: () => void
  /** Stack position from the bottom, so two toasts don't overlap. */
  offset?: 0 | 1
  tone?: 'neutral' | 'celebrate'
}

const VISIBLE_MS = 6000

/**
 * A short-lived toast at the bottom of the screen. On desktop it sits
 * bottom-centre of the map (the viewport minus the 360px sidebar): 48px,
 * radius 12, #0F172A, per the Atlas v2 design.
 */
export default function Toast({ message, action, onDismiss, offset = 0, tone = 'neutral' }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <div
      role="status"
      className={`fixed z-50 left-1/2 lg:left-[calc((100vw-360px)/2)] -translate-x-1/2 flex items-center gap-4 pl-4 ${action ? 'pr-2' : 'pr-4'} min-h-11 lg:min-h-12 py-1.5 max-w-[calc(100vw-2rem)] rounded-full lg:rounded-xl text-white text-sm shadow-lg lg:shadow-[0_6px_20px_rgba(15,23,42,0.3)] ${
        offset ? 'bottom-[4.25rem] lg:bottom-[5.25rem]' : 'bottom-4 lg:bottom-6'
      } ${tone === 'celebrate' ? 'bg-[#0B7A53]' : 'bg-gray-900 lg:bg-[#0F172A]'}`}
    >
      {tone === 'celebrate' && <span aria-hidden="true">✦</span>}
      <span>{message}</span>
      {action && (
        <button type="button" onClick={action.onClick} className="h-8 lg:h-9 px-3 rounded-full lg:rounded-lg font-semibold text-blue-300 lg:text-[#93C5FD] hover:bg-white/10">
          {action.label}
        </button>
      )}
    </div>
  )
}
