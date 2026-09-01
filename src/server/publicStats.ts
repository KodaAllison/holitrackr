import {
  canonicalCountryMetadata,
  isKnownContinent,
  legacyMinus99Alpha3ByCountryName,
} from '../lib/countryMetadata.ts'
import { getContinent } from '../lib/continents.ts'
import type {
  PublicCountry,
  PublicCountryRow,
  PublicStatsHttpResponse,
  PublicStatsRequest,
} from '../types/publicStats.ts'

const PUBLIC_STATS_QUERY = `SELECT country_code, country_name
FROM visited_countries
WHERE user_id = $1 AND status = 'visited'`

const ALLOWED_ORIGINS = new Set([
  'https://kodaallison.dev',
  'https://www.kodaallison.dev',
  'http://localhost:3000',
])

const SUCCESS_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400'

function createHeaders(origin: string | undefined): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' }
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function normalizeCountry(row: PublicCountryRow): PublicCountry | undefined {
  if (typeof row.country_code !== 'string' || typeof row.country_name !== 'string') return undefined

  const storedCode = row.country_code.trim().toUpperCase()
  const alpha3 = storedCode === '-99'
    ? legacyMinus99Alpha3ByCountryName[row.country_name]
    : storedCode
  if (!alpha3) return undefined

  const metadata = canonicalCountryMetadata[alpha3]
  if (!metadata) return undefined

  const continent = getContinent(alpha3, metadata.name)
  if (!isKnownContinent(continent)) return undefined

  return { alpha3, alpha2: metadata.alpha2, name: metadata.name, continent }
}

export async function handlePublicStatsRequest(
  request: PublicStatsRequest,
): Promise<PublicStatsHttpResponse> {
  const headers = createHeaders(request.origin)

  if (request.method.toUpperCase() === 'OPTIONS') {
    return {
      status: 204,
      headers: {
        ...headers,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'no-store',
      },
    }
  }

  if (request.method.toUpperCase() !== 'GET') {
    return {
      status: 405,
      headers: { ...headers, Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' },
      body: { error: 'Method not allowed' },
    }
  }

  const ownerUserId = request.ownerUserId?.trim()
  if (!ownerUserId) {
    return {
      status: 503,
      headers: { ...headers, 'Cache-Control': 'no-store' },
      body: { error: 'Public stats unavailable' },
    }
  }

  try {
    const { rows } = await request.database.query(PUBLIC_STATS_QUERY, [ownerUserId])
    const countriesByCode = new Map<string, PublicCountry>()

    for (const row of rows) {
      const country = normalizeCountry(row)
      if (country) countriesByCode.set(country.alpha3, country)
    }

    const countries = [...countriesByCode.values()].sort((left, right) => left.name.localeCompare(right.name, 'en'))
    const continents = [...new Set(countries.map((country) => country.continent))]
      .sort((left, right) => left.localeCompare(right, 'en'))

    return {
      status: 200,
      headers: { ...headers, 'Cache-Control': SUCCESS_CACHE_CONTROL },
      body: {
        countries,
        countryCount: countries.length,
        continentCount: continents.length,
        continents,
        generatedAt: (request.now ?? (() => new Date()))().toISOString(),
      },
    }
  } catch {
    return {
      status: 500,
      headers: { ...headers, 'Cache-Control': 'no-store' },
      body: { error: 'Failed to load public stats' },
    }
  }
}
