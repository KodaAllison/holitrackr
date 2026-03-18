import { betterAuth } from "better-auth";
import { toNodeHandler } from "better-auth/node";
import { Pool } from "pg";
import type { IncomingMessage, ServerResponse } from "http";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[auth] Missing required environment variable: ${name}`);
  }
  return value;
}

const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:5173";
const secret = getRequiredEnv("BETTER_AUTH_SECRET");
const googleClientId = getRequiredEnv("GOOGLE_CLIENT_ID");
const googleClientSecret = getRequiredEnv("GOOGLE_CLIENT_SECRET");
const databaseUrl = getRequiredEnv("DATABASE_URL");

const auth = betterAuth({
  database: new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost")
      ? undefined
      : { rejectUnauthorized: false },
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
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  trustedOrigins: [baseURL],
});

const handler = toNodeHandler(auth);

export default async function (req: IncomingMessage, res: ServerResponse) {
  try {
    await handler(req, res);
  } catch (err) {
    console.error("Auth handler error:", err);
    if (!res.headersSent) {
      const status =
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        typeof err.status === "number"
          ? err.status
          : 500;
      const message =
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof err.message === "string"
          ? err.message
          : "Authentication failed";
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: message }));
    }
  }
}
