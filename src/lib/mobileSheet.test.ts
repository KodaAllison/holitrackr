import { describe, expect, it } from 'vitest'
import type { VisitedCountry } from '../types'
import {
  SHEET_PEEK, clampSheetHeight, countrySummary, expandedHeight, formatVisitMonthLong, isTap,
  mobileRowSubline, sheetIsModal, snapExpanded,
} from './mobileSheet'

const c = (code: string, name: string, extra: Partial<VisitedCountry> = {}): VisitedCountry =>
  ({ code, name, status: 'visited', ...extra })

describe('sheet geometry', () => {
  it('leaves room for the search above the expanded sheet', () => {
    expect(expandedHeight(844)).toBe(756)
    expect(expandedHeight(200)).toBe(SHEET_PEEK)
  })

  it('clamps a drag between the two heights', () => {
    expect(clampSheetHeight(100, 256, 756)).toBe(256)
    expect(clampSheetHeight(900, 256, 756)).toBe(756)
    expect(clampSheetHeight(400, 256, 756)).toBe(400)
  })

  it('snaps to the nearer end on a slow release', () => {
    expect(snapExpanded({ height: 600, velocity: 0.1, collapsed: 256, expanded: 756 })).toBe(true)
    expect(snapExpanded({ height: 400, velocity: -0.1, collapsed: 256, expanded: 756 })).toBe(false)
  })

  it('follows a flick whatever the distance', () => {
    expect(snapExpanded({ height: 270, velocity: 0.8, collapsed: 256, expanded: 756 })).toBe(true)
    expect(snapExpanded({ height: 740, velocity: -0.8, collapsed: 256, expanded: 756 })).toBe(false)
  })

  it('treats tiny movement as a tap', () => {
    expect(isTap(3)).toBe(true)
    expect(isTap(-5)).toBe(true)
    expect(isTap(12)).toBe(false)
  })
})

describe('sheetIsModal', () => {
  it('is modal only when expanded with a country open', () => {
    expect(sheetIsModal({ hasCountry: true, expanded: true })).toBe(true)
    expect(sheetIsModal({ hasCountry: true, expanded: false })).toBe(false)
    expect(sheetIsModal({ hasCountry: false, expanded: true })).toBe(false)
    expect(sheetIsModal({ hasCountry: false, expanded: false })).toBe(false)
  })
})

describe('countrySummary', () => {
  it('formats date, stars and tags', () => {
    const italy = c('ITA', 'Italy', { visitedAt: '2023-06', rating: 4, tags: ['Food', 'History'] })
    expect(countrySummary(italy)).toEqual({ text: 'June 2023', stars: '★★★★', tags: 'Food, History' })
  })

  it('nudges for a date when there is none', () => {
    expect(countrySummary(c('-99', 'France'))).toEqual({ text: 'Add a visit date', stars: undefined, tags: undefined })
  })

  it('describes bucket-list plans', () => {
    expect(countrySummary(c('JPN', 'Japan', { status: 'bucketlist', visitedAt: '2027-02' })).text).toBe('Hoping to go · February 2027')
    expect(countrySummary(c('JPN', 'Japan', { status: 'bucketlist' })).text).toBe('On your bucket list')
  })

  it('ignores malformed months and out-of-range ratings', () => {
    expect(formatVisitMonthLong('2023-13')).toBeNull()
    expect(countrySummary(c('ITA', 'Italy', { rating: 9 })).stars).toBeUndefined()
  })
})

describe('mobileRowSubline', () => {
  it('prefixes the continent', () => {
    expect(mobileRowSubline(c('DEU', 'Germany', { visitedAt: '2018-05' }))).toBe('Europe · May 2018')
    expect(mobileRowSubline(c('-99', 'France'))).toBe('Europe · Add a visit date')
    expect(mobileRowSubline(c('JPN', 'Japan', { status: 'bucketlist' }))).toBe('Asia · Add when you hope to go')
  })
})
