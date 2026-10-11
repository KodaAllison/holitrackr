import { createAuth } from './createAuth.js'
import { createNeonPool } from './neonPool.js'

/**
 * Better Auth and the Neon pool for the Vercel functions: one instance shared by
 * `api/auth/[...all].ts` and `src/server/vercelApi.ts`. The base URL comes from
 * the VERCEL_* variables and every deployment URL is a trusted origin.
 */

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

export const auth = createAuth({
  database: pool,
  baseURL,
  trustedOrigins: [...trustedOrigins],
  secret: process.env.BETTER_AUTH_SECRET,
  // Non-null: set in every Vercel environment (as before this module existed).
  googleClientId: process.env.GOOGLE_CLIENT_ID!,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
})
