import type { ReactNode } from 'react'

interface ToastStackProps {
  /** Toasts, lowest first; empty slots (false / null) are skipped. */
  children: ReactNode
}

/**
 * Where toasts live, stacked upwards with a 12px gap so they never overlap
 * however their text wraps. Desktop: bottom-centre of the map (the viewport
 * minus the 360px sidebar). Below `lg`: just above the country sheet's
 * 256px peek.
 */
export default function ToastStack({ children }: ToastStackProps) {
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[272px] z-50 flex flex-col-reverse items-center gap-3 lg:inset-x-auto lg:bottom-6 lg:left-[calc((100vw-360px)/2)] lg:w-[min(560px,calc(100vw-400px))] lg:-translate-x-1/2">
      {children}
    </div>
  )
}
