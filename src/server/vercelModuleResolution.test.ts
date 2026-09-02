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
  it('ships shared TypeScript sources with every API function', () => {
    const vercelConfig = JSON.parse(
      readFileSync(resolve(projectRoot, 'vercel.json'), 'utf8'),
    ) as { functions?: Record<string, { includeFiles?: string }> }

    expect(vercelConfig.functions?.['api/**/*.ts']?.includeFiles).toBe('src/**')
  })

  it.each(productionModules)('%s targets emitted JavaScript modules', (relativePath) => {
    const modulePath = resolve(projectRoot, relativePath)
    const source = readFileSync(modulePath, 'utf8')
    const imports = [...source.matchAll(runtimeImportPattern)].map((match) => match[1])

    for (const specifier of imports) {
      expect(
        extname(specifier),
        `${relativePath}: ${specifier} must target the JavaScript emitted by Vercel`,
      ).toBe('.js')
      expect(
        existsSync(resolve(dirname(modulePath), specifier.replace(/\.js$/, '.ts'))),
        `${relativePath}: ${specifier} must map to a checked-in TypeScript source file`,
      ).toBe(true)
    }
  })
})
