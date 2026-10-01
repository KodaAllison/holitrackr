/**
 * The visit-date encoding, in one place.
 *
 * A visit is recorded to the month. The API and UI carry it as `YYYY-MM`
 * (`visitedAt`); the database stores it in a DATE column as `YYYY-MM-01`
 * (`visit_date`). Everything that parses, converts or displays a visit date
 * goes through these helpers. No browser or server dependencies, so both
 * sides can import it.
 */

const VISIT_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/

export interface VisitMonth {
  year: number
  /** 1-12 */
  month: number
}

/** Whether `value` is a well-formed `YYYY-MM` visit month. */
export function isVisitMonth(value: unknown): value is string {
  return typeof value === 'string' && VISIT_MONTH.test(value)
}

/** Split a `YYYY-MM` visit month, or `null` if it is missing or malformed. */
export function parseVisitMonth(value: string | undefined): VisitMonth | null {
  const match = value ? VISIT_MONTH.exec(value) : null
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) }
}

/** `YYYY-MM` → the `YYYY-MM-01` DATE value, or `null` if not a valid month. */
export function toStoredVisitDate(value: unknown): string | null {
  return isVisitMonth(value) ? `${value}-01` : null
}

/** A stored `YYYY-MM-DD` DATE value → `YYYY-MM`. */
export function fromStoredVisitDate(stored: string | Date | null): string | undefined {
  if (!stored) return undefined
  // Defensive: a raw DATE from pg is a local-midnight Date; use local fields
  // (toISOString could roll back into the previous month).
  if (stored instanceof Date) {
    return `${stored.getFullYear()}-${String(stored.getMonth() + 1).padStart(2, '0')}`
  }
  return stored.slice(0, 7)
}

/** Full month name for a 1-12 month, e.g. `8` → "August". */
export function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleDateString('en-US', { month: 'long' })
}

/** Short label for a visit month, e.g. `2026-08` → "Aug 2026"; `null` if malformed. */
export function formatVisitMonth(value: string | undefined): string | null {
  const parsed = parseVisitMonth(value)
  if (!parsed) return null
  return new Date(parsed.year, parsed.month - 1, 1)
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
