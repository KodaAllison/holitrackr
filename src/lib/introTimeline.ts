import type { Rotation } from './mapEngine/globeMotion'
import { ease } from './mapEngine/globeMotion'

/**
 * Timing for the startup intro, as pure functions of elapsed ms so it can be
 * tested and so the last frame lands exactly on the interactive globe.
 */
export const SPIN_MS = 1400
const FILL_START_MS = 500
const FILL_MS = 350
const MAX_STAGGER_MS = 70
const MAX_STAGGER_TOTAL_MS = 1200
const SETTLE_MS = 800
/** Degrees of extra spin the globe arrives with. */
const SPIN_DEGREES = 140

export interface IntroPlan {
  /** When each marked country (by order) starts filling, in ms. */
  fillStart: (order: number) => number
  /** When the settle into the light palette starts and ends. */
  settleStart: number
  duration: number
}

export function planIntro(markedCount: number): IntroPlan {
  const stagger = markedCount > 1 ? Math.min(MAX_STAGGER_MS, MAX_STAGGER_TOTAL_MS / (markedCount - 1)) : 0
  const fillsEnd = FILL_START_MS + stagger * Math.max(0, markedCount - 1) + FILL_MS
  const settleStart = Math.max(SPIN_MS, fillsEnd)
  return {
    fillStart: order => FILL_START_MS + order * stagger,
    settleStart,
    duration: settleStart + SETTLE_MS,
  }
}

export interface IntroState {
  rotate: Rotation
  /** Globe scale relative to its final radius. */
  scale: number
  /** 0 dark, 1 light. */
  light: number
  fill: (order: number) => number
  done: boolean
}

export function introAt(plan: IntroPlan, ms: number, target: Rotation): IntroState {
  const spin = ease(Math.min(1, ms / SPIN_MS))
  const out = 1 - Math.pow(1 - Math.min(1, ms / SPIN_MS), 3)
  return {
    rotate: [target[0] + SPIN_DEGREES * (1 - out), target[1]],
    scale: 0.72 + 0.28 * spin,
    light: ease(Math.max(0, Math.min(1, (ms - plan.settleStart) / SETTLE_MS))),
    fill: order => Math.max(0, Math.min(1, (ms - plan.fillStart(order)) / FILL_MS)),
    done: ms >= plan.duration,
  }
}
