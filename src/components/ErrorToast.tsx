import { useEffect } from 'react'

interface ErrorToastProps {
  message: string
  onRetry?: () => void
  onDismiss: () => void
}

const VISIBLE_MS = 8000

/**
 * A failed save, e.g. "Couldn't save Portugal. Undone." with Retry. Dark,
 * with a red alert icon; below `lg` it sits just above the country sheet's peek.
 */
export default function ErrorToast({ message, onRetry, onDismiss }: ErrorToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-[272px] z-50 flex h-[52px] items-center gap-2.5 rounded-xl bg-[#0F172A] pl-3.5 pr-1.5 text-sm text-white shadow-[0_6px_20px_rgba(15,23,42,0.3)] lg:inset-x-auto lg:bottom-6 lg:left-1/2 lg:w-[420px] lg:-translate-x-1/2"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FCA5A5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
      </svg>
      <span className="min-w-0 flex-1 truncate">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-10 shrink-0 rounded-lg px-3 font-semibold text-[#93C5FD] hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
        >
          Retry
        </button>
      )}
    </div>
  )
}
