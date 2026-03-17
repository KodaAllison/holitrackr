import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import path from "path";

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
const dbPath = process.env.AUTH_DB_PATH
  ? path.resolve(process.env.AUTH_DB_PATH)
  : path.resolve("./auth.db");

const authConfig = {
  database: new Database(dbPath),
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
