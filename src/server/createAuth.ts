import { betterAuth } from 'better-auth'

/**
 * The one Better Auth configuration, shared by the dev server (`src/lib/auth.ts`)
 * and the Vercel functions (`src/server/vercelAuth.ts`). What differs per
 * environment (the database pool, base URL and trusted origins) is a parameter;
 * the secret, Google provider and session lifetime are the same everywhere.
 */

/** Better Auth's database option: a `pg` or Neon pool. */
type AuthDatabase = Parameters<typeof betterAuth>[0] extends infer Options
  ? Options extends { database?: infer Database } ? NonNullable<Database> : never
  : never

export interface AuthSettings {
  database: AuthDatabase
  baseURL: string
  trustedOrigins: string[]
  secret: string | undefined
  googleClientId: string
  googleClientSecret: string
}

export function createAuth(settings: AuthSettings) {
  return betterAuth({
    database: settings.database,
    baseURL: settings.baseURL,
    secret: settings.secret,
    socialProviders: {
      google: {
        clientId: settings.googleClientId,
        clientSecret: settings.googleClientSecret,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    trustedOrigins: settings.trustedOrigins,
  })
}
