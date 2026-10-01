import type { ReactNode } from 'react'

interface ToastStackProps {
  /** Toasts, lowest first; empty slots (false / null) are skipped. */
  children: ReactNode
}

/**
 * Where toasts live, stacked upwards with a 12px gap so they never overlap
 * however their text wraps. Desktop: bottom-centre of the map (the viewport
 * minus the 360px sidebar). Below `lg`: 16px above the country sheet's
 * top edge, whatever its height (`--sheet-height`, set by `MobileSheet`;
 * the 256px peek when there is none), but never higher than just under
 * the floating search (16px + 46px + a 12px gap, plus the 48px toast).
 */
export default function ToastStack({ children }: ToastStackProps) {
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[min(calc(var(--sheet-height,256px)_+_16px),calc(100dvh_-_122px))] z-50 transition-[bottom] duration-150 ease-out motion-reduce:transition-none flex flex-col-reverse items-center gap-3 lg:inset-x-auto lg:bottom-6 lg:transition-none lg:left-[calc((100vw-360px)/2)] lg:w-[min(560px,calc(100vw-400px))] lg:-translate-x-1/2">
      {children}
    </div>
  )
}
