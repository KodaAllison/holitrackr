import { Pool } from "pg";
import { createAuth } from "../server/createAuth";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[auth] Missing required environment variable: ${name}. Copy .env.example to .env and set it.`
    );
  }
  return value;
}

const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:5173";
const secret = getRequiredEnv("BETTER_AUTH_SECRET");
const googleClientId = getRequiredEnv("GOOGLE_CLIENT_ID");
const googleClientSecret = getRequiredEnv("GOOGLE_CLIENT_SECRET");
const databaseUrl = getRequiredEnv("DATABASE_URL");

// Dev server only (server.ts): a plain pg pool; Vercel uses src/server/vercelAuth.ts.
const authConfig = {
  database: new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost")
      ? undefined
      : { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  }),
};

export const auth = createAuth({
  database: authConfig.database,
  baseURL,
  trustedOrigins: [baseURL],
  secret,
  googleClientId,
  googleClientSecret,
});
export { authConfig };
