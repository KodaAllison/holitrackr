import { betterAuth } from "better-auth";
import { Pool } from "pg";

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

const authConfig = {
  database: new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost")
      ? undefined
      : { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  }),
  baseURL,
  secret,
  socialProviders: {
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: [baseURL],
};

export const auth = betterAuth(authConfig);
export { authConfig };
