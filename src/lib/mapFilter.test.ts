import { describe, expect, it } from 'vitest'
import { markedMessage, SHOW_ALL, shownStatus, withShown } from './mapFilter'

describe('shownStatus', () => {
  it('passes every status through when both are shown', () => {
    expect(shownStatus('visited', SHOW_ALL)).toBe('visited')
    expect(shownStatus('bucketlist', SHOW_ALL)).toBe('bucketlist')
    expect(shownStatus(undefined, SHOW_ALL)).toBeUndefined()
  })

  it('hides only the unchecked status', () => {
    const noBucket = { visited: true, bucketlist: false }
    expect(shownStatus('visited', noBucket)).toBe('visited')
    expect(shownStatus('bucketlist', noBucket)).toBeUndefined()
    const noVisited = { visited: false, bucketlist: true }
    expect(shownStatus('visited', noVisited)).toBeUndefined()
    expect(shownStatus('bucketlist', noVisited)).toBe('bucketlist')
  })
})

describe('withShown', () => {
  it('toggles one status without touching the other or the original', () => {
    const next = withShown(SHOW_ALL, 'visited', false)
    expect(next).toEqual({ visited: false, bucketlist: true })
    expect(SHOW_ALL).toEqual({ visited: true, bucketlist: true })
    expect(withShown(next, 'visited', true)).toEqual(SHOW_ALL)
  })
})

describe('markedMessage', () => {
  it('says what the mark did', () => {
    expect(markedMessage('Italy', 'visited')).toBe('Italy marked as visited')
    expect(markedMessage('Peru', 'bucketlist')).toBe('Peru added to your bucket list')
  })
})
