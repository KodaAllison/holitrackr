import { betterAuth } from "better-auth";
import { toNodeHandler } from "better-auth/node";
import { Pool } from "@neondatabase/serverless";
import type { IncomingMessage, ServerResponse } from "http";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("[auth] Missing required environment variable: DATABASE_URL");
}

const cleanUrl = databaseUrl.replace(/[&?]channel_binding=[^&]*/g, "");

const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173");

const pool = new Pool({ connectionString: cleanUrl });

const auth = betterAuth({
  database: pool,
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Authentication failed" }));
    }
  }
}
