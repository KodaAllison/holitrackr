import { describe, expect, it } from 'vitest'
import { searchStatusToMark } from './searchStatus'

describe('searchStatusToMark', () => {
  it('marks an unmarked country with the picked status', () => {
    expect(searchStatusToMark(undefined, 'visited')).toBe('visited')
    expect(searchStatusToMark(undefined, 'bucketlist')).toBe('bucketlist')
  })

  it('switches a marked country to the other status', () => {
    expect(searchStatusToMark('visited', 'bucketlist')).toBe('bucketlist')
    expect(searchStatusToMark('bucketlist', 'visited')).toBe('visited')
  })

  it('does nothing when the picked status is already the current one', () => {
    expect(searchStatusToMark('visited', 'visited')).toBeUndefined()
    expect(searchStatusToMark('bucketlist', 'bucketlist')).toBeUndefined()
  })
})
