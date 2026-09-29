import { useEffect } from 'react'

interface UndoToastProps {
  message: string
  onUndo: () => void
  onDismiss: () => void
}

const VISIBLE_MS = 6000

/** A short-lived "… · Undo" toast at the bottom of the screen. */
export default function UndoToast({ message, onUndo, onDismiss }: UndoToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <div role="status" className="fixed z-50 bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 pl-4 pr-2 h-11 rounded-full bg-gray-900 text-white text-sm shadow-lg">
      <span>{message}</span>
      <button type="button" onClick={onUndo} className="h-8 px-3 rounded-full font-semibold text-blue-300 hover:bg-white/10">Undo</button>
    </div>
  )
}
