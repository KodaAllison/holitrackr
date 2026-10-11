import { fromNodeHeaders } from 'better-auth/node'
import type { IncomingMessage, ServerResponse } from 'http'
import type { QueryResultRow } from 'pg'
import type { CountriesDatabase } from './countryVisits.js'
import { auth, pool } from './vercelAuth.js'

/**
 * Shared setup for the session-scoped Vercel functions (`api/countries.ts`,
 * `api/countries/visits.ts`): the Neon pool and Better Auth (from
 * `vercelAuth.ts`), and small request and response helpers. Loaded only by
 * those functions, never by the client.
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

export const database: CountriesDatabase = {
  query: <Row extends QueryResultRow>(statement: string, parameters: unknown[]) =>
    pool.query<Row>(statement, parameters),
}

/** The signed-in user's id, or undefined. */
export async function sessionUserId(req: IncomingMessage): Promise<string | undefined> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
  return session?.user?.id
}
