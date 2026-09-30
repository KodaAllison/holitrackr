import type { VisitedCountry } from '../types'
import { getContinent } from './continents'
import { formatVisitMonth, monthName, parseVisitMonth } from './visitDate'

/**
 * The mobile bottom sheet's geometry and the text it shows. Pure, so the
 * snap maths and formatting are unit-tested.
 */

/** Height of the list sheet when collapsed (the design's "peek"). */
export const SHEET_PEEK = 256
/** Space kept above the expanded sheet, so the floating search stays usable (16 + 46 + 26). */
export const SHEET_TOP_GAP = 88
/** CSS variable on <html> holding the mounted sheet's current height, e.g. `312px`. */
export const SHEET_HEIGHT_VAR = '--sheet-height'
/** Movement under this many px is a tap on the handle, not a drag. */
export const TAP_SLOP = 6
/** A flick faster than this (px/ms) snaps in its direction, whatever the distance. */
export const FLICK_VELOCITY = 0.5

/** The expanded sheet's height for a viewport height. */
export function expandedHeight(viewportHeight: number): number {
  return Math.max(SHEET_PEEK, viewportHeight - SHEET_TOP_GAP)
}

/** Keep a dragged height between the collapsed and expanded heights. */
export function clampSheetHeight(height: number, collapsed: number, expanded: number): number {
  return Math.min(expanded, Math.max(collapsed, height))
}

export interface SheetRelease {
  /** Height when the drag ended. */
  height: number
  /** Upward speed in px/ms (positive = growing). */
  velocity: number
  collapsed: number
  expanded: number
}

/** Where a released drag settles: a flick goes its way; otherwise the nearer end. */
export function snapExpanded({ height, velocity, collapsed, expanded }: SheetRelease): boolean {
  if (Math.abs(velocity) >= FLICK_VELOCITY) return velocity > 0
  return height - collapsed > (expanded - collapsed) / 2
}

/** Whether a pointer that moved `dy` px counts as a tap. */
export function isTap(dy: number): boolean {
  return Math.abs(dy) < TAP_SLOP
}

/** Long label for a visit month, e.g. `2023-06` → "June 2023"; `null` if malformed. */
export function formatVisitMonthLong(value: string | undefined): string | null {
  const parsed = parseVisitMonth(value)
  return parsed ? `${monthName(parsed.month)} ${parsed.year}` : null
}

/** The summary line under the name; `stars` is rendered in its own colour. */
export interface CountrySummary {
  text: string
  stars?: string
  tags?: string
}

/**
 * The selected country's summary line on mobile, e.g.
 * "June 2023 · ★★★★ · Food, History". Missing parts are left out.
 */
export function countrySummary(country: VisitedCountry): CountrySummary {
  const when = formatVisitMonthLong(country.visitedAt)
  const tags = country.tags && country.tags.length > 0 ? country.tags.join(', ') : undefined
  if (country.status === 'bucketlist') {
    return { text: when ? `Hoping to go · ${when}` : 'On your bucket list', tags }
  }
  const stars = country.rating && country.rating >= 1 && country.rating <= 5 ? '★'.repeat(country.rating) : undefined
  return { text: when ?? 'Add a visit date', stars, tags }
}

/** A mobile list row's sub-line, e.g. "Europe · May 2018". */
export function mobileRowSubline(country: VisitedCountry): string {
  const when = formatVisitMonth(country.visitedAt)
  const detail = country.status === 'bucketlist'
    ? (when ? `Hoping to go · ${when}` : 'Add when you hope to go')
    : (when ?? 'Add a visit date')
  return `${getContinent(country.code, country.name)} · ${detail}`
}
