import { describe, expect, it } from 'vitest'
import { clusterAt, clusterDots } from './clusters'

describe('clusterDots', () => {
  it('merges dots within the radius and keeps distant ones apart', () => {
    const clusters = clusterDots([
      { item: 'a', x: 0, y: 0 },
      { item: 'b', x: 6, y: 0 },
      { item: 'c', x: 100, y: 100 },
    ], 10)
    expect(clusters).toHaveLength(2)
    expect(clusters[0]).toEqual({ x: 3, y: 0, members: ['a', 'b'] })
    expect(clusters[1].members).toEqual(['c'])
  })

  it('returns single-member clusters when nothing is close', () => {
    expect(clusterDots([{ item: 1, x: 0, y: 0 }, { item: 2, x: 50, y: 0 }], 10)).toHaveLength(2)
  })
})

describe('clusterAt', () => {
  const clusters = [
    { x: 0, y: 0, members: ['a'] },
    { x: 20, y: 0, members: ['b'] },
  ]

  it('picks the nearest cluster within the radius', () => {
    expect(clusterAt(clusters, 14, 0, 12)?.members).toEqual(['b'])
  })

  it('returns null outside every radius', () => {
    expect(clusterAt(clusters, 0, 40, 12)).toBeNull()
  })
})
