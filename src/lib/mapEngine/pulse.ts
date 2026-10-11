/** How long the milestone pulse runs once the view has landed on the country. */
export const PULSE_MS = 1400

export interface PulseRing {
  /** CSS px. */
  radius: number
  alpha: number
  lineWidth: number
}

/** The expanding rings `elapsed` ms into the pulse: two, staggered, each fading as it grows. */
export function pulseRings(elapsed: number): PulseRing[] {
  const u = elapsed / PULSE_MS
  const rings: PulseRing[] = []
  for (const offset of [0, 0.35]) {
    const v = u - offset
    if (v < 0 || v > 0.65) continue
    const t = v / 0.65
    rings.push({ radius: 6 + 34 * t, alpha: 0.8 * (1 - t), lineWidth: 3 * (1 - t) + 1 })
  }
  return rings
}

/**
 * Draws the milestone pulse at `at` (CSS px; skipped when null) `elapsed` ms
 * in, on a context set up for CSS px. False once it has finished; negative
 * `elapsed` is a pulse still waiting for the view to land.
 */
export function drawPulse(ctx: CanvasRenderingContext2D, at: [number, number] | null, elapsed: number): boolean {
  if (elapsed >= PULSE_MS) return false
  if (!at || elapsed < 0) return true
  for (const ring of pulseRings(elapsed)) {
    ctx.beginPath()
    ctx.arc(at[0], at[1], ring.radius, 0, 2 * Math.PI)
    ctx.strokeStyle = `rgba(11,122,83,${ring.alpha})`
    ctx.lineWidth = ring.lineWidth
    ctx.stroke()
  }
  return true
}
