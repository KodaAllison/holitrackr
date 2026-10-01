import { describe, expect, it } from 'vitest'
import {
  formatVisitMonth,
  fromStoredVisitDate,
  isVisitMonth,
  monthName,
  parseVisitMonth,
  toStoredVisitDate,
} from './visitDate'

describe('isVisitMonth', () => {
  it('accepts YYYY-MM with months 01-12', () => {
    expect(isVisitMonth('2026-01')).toBe(true)
    expect(isVisitMonth('2026-12')).toBe(true)
  })

  it('rejects malformed or out-of-range values', () => {
    for (const value of ['2026-00', '2026-13', '2026-8', '2026', '2026-08-01', ' 2026-08', 202608, null]) {
      expect(isVisitMonth(value)).toBe(false)
    }
  })
})

describe('parseVisitMonth', () => {
  it('splits a valid month into numbers', () => {
    expect(parseVisitMonth('2026-08')).toEqual({ year: 2026, month: 8 })
  })

  it('returns null for missing or malformed values', () => {
    expect(parseVisitMonth(undefined)).toBeNull()
    expect(parseVisitMonth('')).toBeNull()
    expect(parseVisitMonth('2026-13')).toBeNull()
  })
})

describe('stored date round trip', () => {
  it('stores a month as the first of that month', () => {
    expect(toStoredVisitDate('2026-08')).toBe('2026-08-01')
  })

  it('stores null for anything that is not a valid month', () => {
    expect(toStoredVisitDate('2026-13')).toBeNull()
    expect(toStoredVisitDate(undefined)).toBeNull()
    expect(toStoredVisitDate(42)).toBeNull()
  })

  it('reads a stored date back as YYYY-MM', () => {
    expect(fromStoredVisitDate('2026-08-01')).toBe('2026-08')
    expect(fromStoredVisitDate(null)).toBeUndefined()
  })

  it('round-trips every month', () => {
    for (let m = 1; m <= 12; m++) {
      const month = `2026-${String(m).padStart(2, '0')}`
      expect(fromStoredVisitDate(toStoredVisitDate(month))).toBe(month)
    }
  })
})

describe('display', () => {
  it('formats a short month-year label', () => {
    expect(formatVisitMonth('2026-08')).toBe('Aug 2026')
    expect(formatVisitMonth('1999-12')).toBe('Dec 1999')
  })

  it('returns null for missing or malformed values', () => {
    expect(formatVisitMonth(undefined)).toBeNull()
    expect(formatVisitMonth('2026')).toBeNull()
  })

  it('names months', () => {
    expect(monthName(1)).toBe('January')
    expect(monthName(8)).toBe('August')
  })
})

describe('fromStoredVisitDate with a Date', () => {
  it('reads a pg local-midnight Date without rolling back a month', () => {
    expect(fromStoredVisitDate(new Date(2024, 4, 1))).toBe('2024-05')
  })
})
