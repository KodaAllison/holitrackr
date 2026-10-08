import { describe, expect, it } from 'vitest'
import { focusOnMount, focusState, openerFrom, returnFocusTarget } from './panelFocus'

// Stand-ins for elements: just names, with the sidebar's contents listed.
const body = 'body'
const sidebar = new Set(['row:ITA', 'heading', 'handle'])
const inside = (el: string) => sidebar.has(el)

describe('focusState', () => {
  it('is lost on <body> or nowhere', () => {
    expect(focusState(body, body, inside)).toBe('lost')
    expect(focusState(null, body, inside)).toBe('lost')
    expect(focusState(undefined, body, inside)).toBe('lost')
  })

  it('tells the sidebar from the rest of the page', () => {
    expect(focusState('handle', body, inside)).toBe('inside')
    expect(focusState('search', body, inside)).toBe('elsewhere')
  })
})

describe('focusOnMount', () => {
  it('moves focus to a new panel unless it is already inside the sidebar', () => {
    expect(focusOnMount('lost')).toBe(true) // the clicked row was replaced
    expect(focusOnMount('elsewhere')).toBe(true) // picked from the search
    expect(focusOnMount('inside')).toBe(false) // the sheet handle, expanding / collapsing
  })
})

describe('openerFrom', () => {
  it('remembers only something outside the sidebar', () => {
    expect(openerFrom('search', 'elsewhere')).toBe('search')
    expect(openerFrom(body, 'lost')).toBeNull()
    expect(openerFrom('handle', 'inside')).toBeNull()
  })
})

describe('returnFocusTarget', () => {
  const all = () => true

  it('leaves focus alone unless it was lost', () => {
    expect(returnFocusTarget('elsewhere', { row: 'row:ITA' }, all)).toBeNull()
    expect(returnFocusTarget('inside', { row: 'row:ITA' }, all)).toBeNull()
  })

  it("prefers the closed country's row", () => {
    expect(returnFocusTarget('lost', { row: 'row:ITA', opener: 'search', fallbacks: ['list'] }, all)).toBe('row:ITA')
  })

  it('falls back to the opener, then the fallbacks in order', () => {
    expect(returnFocusTarget('lost', { row: null, opener: 'search', fallbacks: ['list'] }, all)).toBe('search')
    expect(returnFocusTarget('lost', { opener: null, fallbacks: [undefined, 'list', 'other'] }, all)).toBe('list')
  })

  it('skips candidates that are gone, hidden or inert', () => {
    const usable = (el: string) => el !== 'search' && el !== 'row:ITA'
    expect(returnFocusTarget('lost', { row: 'row:ITA', opener: 'search', fallbacks: ['list'] }, usable)).toBe('list')
  })

  it('gives up when nothing is usable', () => {
    expect(returnFocusTarget('lost', {}, all)).toBeNull()
    expect(returnFocusTarget('lost', { row: 'row:ITA' }, () => false)).toBeNull()
  })
})
