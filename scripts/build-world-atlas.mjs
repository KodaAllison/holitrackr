#!/usr/bin/env node
/**
 * Builds the compact world TopoJSON files the map loads.
 *
 *   node scripts/build-world-atlas.mjs
 *
 * Source is the same datasets/geo-countries GeoJSON the map used to fetch at
 * runtime (14.6 MB), pinned to a commit. Keeping the source means every
 * feature keeps its exact `name` and `ISO3166-1-Alpha-3` values, so saved
 * `visited_countries` rows still match their features with no migration.
 *
 * Two levels of detail are written to src/data/:
 *   world-motion.topo.json  ~1% of vertices; spin, intro and globe/flat morph
 *   world-detail.topo.json  ~6% of vertices; the map at rest and when zoomed
 *
 * `keep-shapes` stops simplification from deleting small islands and
 * micro-states, and the script fails if any source identity goes missing.
 *
 * mapshaper runs through a pinned `npx` so its large dependency tree stays
 * out of package.json and every install; only this script needs it.
 */
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const MAPSHAPER = 'mapshaper@0.7.70'

const SOURCE_COMMIT = '185beb1137f6e9f5d916c91916f0159c20fbab30'
const SOURCE_URL =
  `https://raw.githubusercontent.com/datasets/geo-countries/${SOURCE_COMMIT}/data/countries.geojson`

const OUT_DIR = new URL('../src/data/', import.meta.url)
const LEVELS = [
  { file: 'world-motion.topo.json', keep: '1%' },
  { file: 'world-detail.topo.json', keep: '6%' },
]

function identities(features) {
  return features
    .map(f => `${f.properties['ISO3166-1-Alpha-3']}|${f.properties.name}`)
    .sort()
}

const res = await fetch(SOURCE_URL)
if (!res.ok) throw new Error(`Source download failed: ${res.status} ${SOURCE_URL}`)
const source = await res.text()
const expected = identities(JSON.parse(source).features)

const work = await mkdtemp(join(tmpdir(), 'world-atlas-'))
try {
  const input = join(work, 'countries.geojson')
  await writeFile(input, source)

  for (const { file, keep } of LEVELS) {
    const output = join(work, file)
    execFileSync('npx', [
      '--yes', MAPSHAPER,
      '-i', input, 'name=countries',
      '-filter-fields', 'name,ISO3166-1-Alpha-3,ISO3166-1-Alpha-2',
      '-simplify', keep, 'weighted', 'keep-shapes',
      '-o', output, 'format=topojson', 'quantization=100000',
    ], { stdio: ['ignore', 'ignore', 'inherit'] })
    const topo = await readFile(output, 'utf8')

    const got = identities(JSON.parse(topo).objects.countries.geometries.map(g => ({ properties: g.properties })))
    const missing = expected.filter(id => !got.includes(id))
    if (missing.length > 0 || got.length !== expected.length) {
      throw new Error(`${file}: identities changed. Missing: ${missing.join(', ') || 'none'}`)
    }

    await writeFile(new URL(file, OUT_DIR), topo)
    console.log(`${file}: ${got.length} countries, ${(topo.length / 1024).toFixed(0)} KB`)
  }
} finally {
  await rm(work, { recursive: true, force: true })
}
