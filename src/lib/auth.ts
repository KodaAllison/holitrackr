import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

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
const googleClientId = getRequiredEnv("GOOGLE_CLIENT_ID");
const googleClientSecret = getRequiredEnv("GOOGLE_CLIENT_SECRET");

const authConfig = {
  database: new Database("./auth.db"),
  baseURL,
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
