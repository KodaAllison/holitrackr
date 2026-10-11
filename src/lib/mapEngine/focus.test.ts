import { describe, expect, it } from 'vitest'
import { countryKey } from '../visitedCountries'
import { focusAction, type FocusInput } from './focus'

const france = { code: 'FRA', name: 'France' }
const japan = { code: 'JPN', name: 'Japan' }
const opening = { country: france, seq: 3 }

const input = (over: Partial<FocusInput>): FocusInput => ({
  focus: opening, openingSeq: 3, selectedKey: null, ready: true, reapply: 'selected', ...over,
})

describe('focusAction', () => {
  it('acts on a focus set after the view opened', () => {
    const focus = { country: japan, seq: 4 }
    expect(focusAction(input({ focus }))).toBe(focus)
  })

  it('acts on the same country again when it gets a new seq', () => {
    const focus = { country: france, seq: 4, pulse: true }
    expect(focusAction(input({ focus }))).toBe(focus)
  })

  it('reapplies the opening focus while its country is selected', () => {
    expect(focusAction(input({ selectedKey: countryKey(france) }))).toBe(opening)
  })

  it('ignores the opening focus once its country is closed or another is open', () => {
    expect(focusAction(input({ selectedKey: null }))).toBeNull()
    expect(focusAction(input({ selectedKey: countryKey(japan) }))).toBeNull()
  })

  it('always reapplies the opening focus on a view that asks for it (the globe)', () => {
    expect(focusAction(input({ reapply: 'always' }))).toBe(opening)
  })

  it('holds a focus until the view is ready', () => {
    expect(focusAction(input({ focus: { country: japan, seq: 4 }, ready: false }))).toBeNull()
  })

  it('does nothing without a focus', () => {
    expect(focusAction(input({ focus: null, openingSeq: undefined }))).toBeNull()
    expect(focusAction(input({ focus: undefined, reapply: 'always' }))).toBeNull()
  })

  it('treats a first focus on a view opened without one as new', () => {
    const focus = { country: france, seq: 1 }
    expect(focusAction(input({ focus, openingSeq: undefined }))).toBe(focus)
  })
})
