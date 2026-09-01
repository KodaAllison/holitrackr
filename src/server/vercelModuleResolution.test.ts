import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const productionModules = [
  'api/auth/[...all].ts',
  'api/countries.ts',
  'api/public/stats.ts',
  'src/server/publicStats.ts',
]

const runtimeImportPattern = /import\s+(?!type\b)[\s\S]*?\sfrom\s+['"](\.\.?\/[^'"]+)['"]/g

describe('Vercel function module resolution', () => {
  it.each(productionModules)('%s uses resolvable runtime imports', (relativePath) => {
    const modulePath = resolve(projectRoot, relativePath)
    const source = readFileSync(modulePath, 'utf8')
    const imports = [...source.matchAll(runtimeImportPattern)].map((match) => match[1])

    for (const specifier of imports) {
      expect(extname(specifier), `${relativePath}: ${specifier} needs an explicit extension`).not.toBe('')
      expect(
        existsSync(resolve(dirname(modulePath), specifier)),
        `${relativePath}: ${specifier} must resolve to a checked-in file`,
      ).toBe(true)
    }
  })
})
