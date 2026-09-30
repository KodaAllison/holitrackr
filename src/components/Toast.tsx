import { useEffect } from 'react'

interface ToastProps {
  message: string
  /** Optional action, e.g. Undo. */
  action?: { label: string; onClick: () => void }
  onDismiss: () => void
  tone?: 'neutral' | 'celebrate'
}

const VISIBLE_MS = 6000

/** A short-lived toast: 48px, radius 12, #0F172A, per the Atlas v2 design. Place it in a `ToastStack`. */
export default function Toast({ message, action, onDismiss, tone = 'neutral' }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <div
      role="status"
      className={`pointer-events-auto flex max-w-full items-center gap-4 pl-4 ${action ? 'pr-2' : 'pr-4'} min-h-12 py-1.5 rounded-xl text-white text-sm shadow-[0_6px_20px_rgba(15,23,42,0.3)] ${
        tone === 'celebrate' ? 'bg-[#0B7A53]' : 'bg-[#0F172A]'
      }`}
    >
      {tone === 'celebrate' && <span aria-hidden="true">✦</span>}
      <span>{message}</span>
      {action && (
        <button type="button" onClick={action.onClick} className="shrink-0 h-9 px-3 rounded-lg font-semibold text-[#93C5FD] hover:bg-white/10">
          {action.label}
        </button>
      )}
    </div>
  )
}
