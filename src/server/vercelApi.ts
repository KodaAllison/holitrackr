import { betterAuth } from 'better-auth'
import { fromNodeHeaders } from 'better-auth/node'
import type { IncomingMessage, ServerResponse } from 'http'
import type { QueryResultRow } from 'pg'
import type { CountriesDatabase } from './countryVisits.js'
import { createNeonPool } from './neonPool.js'

/**
 * Shared setup for the session-scoped Vercel functions (`api/countries.ts`,
 * `api/countries/visits.ts`): the Neon pool, Better Auth, and small request
 * and response helpers. Loaded only by those functions, never by the client.
 */

type RequestBodyResult =
  | { success: true; value: unknown }
  | { success: false }

export async function readRequestBody(req: IncomingMessage): Promise<RequestBodyResult> {
  const contentType = typeof req.headers['content-type'] === 'string'
    ? req.headers['content-type']
    : ''
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return { success: true, value: undefined }
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return { success: true, value: undefined }
  try {
    const value: unknown = JSON.parse(raw)
    return { success: true, value }
  } catch {
    return { success: false }
  }
}

/** End the response with a status and, if given, a JSON body. */
export function sendJson(res: ServerResponse, status: number, body?: unknown): void {
  res.statusCode = status
  if (body === undefined) {
    res.end()
    return
  }
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('[auth] Missing required environment variable: DATABASE_URL')
}

const cleanUrl = databaseUrl.replace(/[&?]channel_binding=[^&]*/g, '')

const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:5173')

const trustedOrigins = new Set([baseURL])
if (process.env.VERCEL_URL) trustedOrigins.add(`https://${process.env.VERCEL_URL}`)
if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
  trustedOrigins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
if (process.env.VERCEL_BRANCH_URL) trustedOrigins.add(`https://${process.env.VERCEL_BRANCH_URL}`)

export const pool = createNeonPool(cleanUrl)

export const database: CountriesDatabase = {
  query: <Row extends QueryResultRow>(statement: string, parameters: unknown[]) =>
    pool.query<Row>(statement, parameters),
}

const auth = betterAuth({
  database: pool,
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders: {
    google: {
      // Non-null: set in every Vercel environment (as before this module existed).
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  trustedOrigins: [...trustedOrigins],
})

/** The signed-in user's id, or undefined. */
export async function sessionUserId(req: IncomingMessage): Promise<string | undefined> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
  return session?.user?.id
}
