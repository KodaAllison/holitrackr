import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decodeWorld } from './worldAtlas'
import { featureIdentity } from './featureIdentity'

function load(file: string): unknown {
  return JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'))
}

const motion = decodeWorld(load('world-motion.topo.json'))
const detail = decodeWorld(load('world-detail.topo.json'))

function identities(features: typeof motion.features): string[] {
  return features.map(f => {
    const id = featureIdentity(f)
    return id ? `${id.code}|${id.name}` : 'MISSING'
  }).sort()
}

describe('world atlas data', () => {
  it('gives every feature a code and name', () => {
    expect(identities(motion.features)).not.toContain('MISSING')
    expect(identities(detail.features)).not.toContain('MISSING')
  })

  it('has the same countries at both levels of detail', () => {
    expect(motion.features).toHaveLength(258)
    expect(identities(motion.features)).toEqual(identities(detail.features))
  })

  it('keeps the identities saved rows were written with', () => {
    const ids = identities(detail.features)
    // Natural Earth's -99 codes must survive as-is; changing them would
    // orphan existing visited_countries rows.
    expect(ids).toEqual(expect.arrayContaining([
      '-99|France', '-99|Norway', '-99|Kosovo', 'ESP|Spain', 'GBR|United Kingdom',
    ]))
  })

  it('keeps micro-states and small islands', () => {
    const ids = identities(motion.features)
    expect(ids).toEqual(expect.arrayContaining([
      'VAT|Vatican', 'MCO|Monaco', 'SGP|Singapore', 'MLT|Malta', 'TUV|Tuvalu',
    ]))
    for (const f of motion.features) {
      expect(f.geometry, featureIdentity(f)?.name).not.toBeNull()
    }
  })
})

describe('decodeWorld', () => {
  it('rejects data that is not a world topology', () => {
    expect(() => decodeWorld({ type: 'FeatureCollection', features: [] })).toThrow()
    expect(() => decodeWorld(null)).toThrow()
  })
})
