import { useEffect, useMemo, useRef, useState } from 'react'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource/jetbrains-mono/500.css'
import { authClient } from '../lib/auth-client'
import { countryKey } from '../lib/visitedCountries'
import { createHatch } from '../lib/mapEngine/renderer'
import { drawSignIn } from '../lib/mapEngine/drawSignIn'
import { useCanvasSize } from '../lib/mapEngine/useCanvasSize'
import { useWorldCountries } from '../lib/mapEngine/useWorldCountries'
import { signInLayout } from '../lib/signInCallout'
import { buildTour, tourAt } from '../lib/signInTour'
import { useMediaQuery } from '../lib/useMediaQuery'

interface SignInScreenProps {
  /** Shown when the session check gave up waiting for the auth server. */
  timedOut?: boolean
}

const mono = "font-['JetBrains_Mono',ui-monospace,monospace] text-[11px] tracking-[0.18em] text-slate-500 leading-[1.8]"
const serif = "font-['Instrument_Serif',Georgia,serif] italic"

/**
 * The signed-out first load: a dark "atlas plate" globe touring a demo
 * journey (never a real user's), the headline orbiting it, and Continue with
 * Google. Reduced motion shows a still frame.
 */
export default function SignInScreen({ timedOut }: SignInScreenProps) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const { motionCountries } = useWorldCountries()
  const { containerRef, canvasRef, size } = useCanvasSize()
  const stops = useMemo(() => (motionCountries ? buildTour(motionCountries) : []), [motionCountries])
  const [count, setCount] = useState(0)
  const [fontsReady, setFontsReady] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const hatch = useRef<CanvasPattern | null>(null)
  const geometry = signInLayout(size.width, size.height)

  useEffect(() => {
    let cancelled = false
    Promise.all([document.fonts.load(`italic 44px "Instrument Serif"`), document.fonts.load(`500 12px "JetBrains Mono"`)])
      .catch(() => undefined)
      .then(() => { if (!cancelled) setFontsReady(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !motionCountries || stops.length === 0 || size.width === 0) return
    hatch.current ??= createHatch(ctx)
    const order = new Map(stops.map((s, i) => [countryKey(s.country.identity), i]))
    const { cx, cy, radius, ctaTop } = signInLayout(size.width, size.height)
    const start = performance.now()
    let frame = 0
    const render = (now: number) => {
      const seconds = (now - start) / 1000
      const moment = tourAt(stops, seconds, reduced)
      drawSignIn({
        ctx, ...size, dpr: window.devicePixelRatio || 1, cx, cy, radius, ctaTop,
        rotate: moment.rotate, countries: motionCountries, hatch: hatch.current,
        fillOf: c => {
          const i = order.get(countryKey(c.identity))
          return i === undefined ? null : { status: stops[i].status, amount: moment.fill(i) }
        },
        orbit: reduced ? 0 : -seconds * 0.04,
        callout: moment.calloutAlpha > 0 ? { stop: stops[moment.index], alpha: moment.calloutAlpha } : null,
      })
      setCount(moment.count)
      if (!reduced) frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [canvasRef, motionCountries, stops, size, reduced, fontsReady])

  const signIn = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/' })
      if (result?.error) setError(result.error.message ?? 'Authentication failed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen h-[100dvh] overflow-hidden bg-[#0B1220] text-slate-50">
      <div ref={containerRef} className="absolute inset-0">
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full" />
      </div>

      <div className="absolute left-5 top-5 sm:left-10 sm:top-9 flex items-center gap-2.5">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18" /><path d="M12 3a14 14 0 0 0 0 18" />
        </svg>
        <span className="text-xl font-bold tracking-tight">MyAtlas</span>
      </div>
      <p className={`hidden sm:block absolute right-10 top-10 text-right ${mono}`}>A PERSONAL ATLAS<br />OF THE 195 COUNTRIES</p>

      {size.width > 0 && (
        <div className="absolute inset-x-0 flex flex-col items-center gap-3 px-6" style={{ top: geometry.ctaTop }}>
          <h1 className={`${serif} font-normal text-[32px] sm:text-[40px] leading-none text-center`}>So, where have you been?</h1>
          {timedOut && (
            <p role="status" className="text-sm text-amber-300">The sign-in server is slow to respond. You can still try.</p>
          )}
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button
            type="button"
            onClick={signIn}
            disabled={loading}
            className="mt-2 h-[52px] w-[300px] max-w-full rounded-full bg-white text-slate-900 text-base font-semibold flex items-center justify-center gap-2.5 shadow-[0_0_0_6px_rgba(147,197,253,0.12),0_8px_24px_rgba(0,0,0,0.35)] hover:bg-slate-50 disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
          >
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.13.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>
          <p className="text-[13px] text-slate-400 text-center">We only use your Google account to sign you in.</p>
        </div>
      )}

      <p className={`hidden md:block absolute left-10 bottom-9 ${mono}`}>PLATE I<br />THE WORLD, AS YOU'VE SEEN IT</p>
      <div className="hidden sm:block absolute right-10 bottom-8 text-right" aria-hidden="true">
        <div className={`${serif} text-[64px] leading-none`}>{count}<span className="text-[28px] text-slate-500"> / 195</span></div>
        <div className={`mt-1.5 ${mono}`}>COUNTRIES, AND COUNTING</div>
      </div>
    </main>
  )
}
