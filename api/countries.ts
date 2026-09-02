import { betterAuth } from 'better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingMessage, ServerResponse } from 'http';
import {
  parseCountryIdentity,
  parseCreateCountryInput,
  parseUpdateCountryInput,
  serializeStoredCountry,
} from '../src/server/countryPayloads.js';
import { createNeonPool } from '../src/server/neonPool.js';
import type { StoredCountryRow } from '../src/types/countriesApi.js';

type RequestBodyResult =
  | { success: true; value: unknown }
  | { success: false }

async function readRequestBody(req: IncomingMessage): Promise<RequestBodyResult> {
  const contentType = typeof req.headers['content-type'] === 'string'
    ? req.headers['content-type']
    : '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return { success: true, value: undefined };
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return { success: true, value: undefined };
  try {
    const value: unknown = JSON.parse(raw);
    return { success: true, value };
  } catch {
    return { success: false };
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('[auth] Missing required environment variable: DATABASE_URL');
}

const cleanUrl = databaseUrl.replace(/[&?]channel_binding=[^&]*/g, '');

const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:5173');

const trustedOrigins = new Set([baseURL]);
if (process.env.VERCEL_URL) trustedOrigins.add(`https://${process.env.VERCEL_URL}`);
if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
  trustedOrigins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
if (process.env.VERCEL_BRANCH_URL) trustedOrigins.add(`https://${process.env.VERCEL_BRANCH_URL}`);

const pool = createNeonPool(cleanUrl);

const auth = betterAuth({
  database: pool,
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET!,
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
  trustedOrigins: [...trustedOrigins],
});

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  try {
    const method = (req.method ?? '').toUpperCase();

    const requestBody = await readRequestBody(req);
    if (!requestBody.success) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    // Require Better Auth session for all /api/countries routes.
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const userId = session?.user?.id;
    if (!userId) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    if (method === 'GET') {
      const { rows } = await pool.query<StoredCountryRow>(
        `SELECT country_code, country_name, status, notes, visit_date, rating, tags
         FROM visited_countries
         WHERE user_id = $1
         ORDER BY visit_date DESC NULLS LAST, created_at DESC`,
        [userId]
      );

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify(rows.map(serializeStoredCountry))
      );
      return;
    }

    if (method === 'POST') {
      const parsed = parseCreateCountryInput(requestBody.value);
      if (!parsed.success) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: parsed.error }));
        return;
      }
      const { code, name, status, notes } = parsed.value;

      await pool.query(
        `INSERT INTO visited_countries (user_id, country_code, country_name, status, notes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, country_code, country_name) DO UPDATE
           SET status = EXCLUDED.status,
               notes = COALESCE(EXCLUDED.notes, visited_countries.notes)`,
        [userId, code, name, status, notes]
      );

      res.statusCode = 204;
      res.end();
      return;
    }

    if (method === 'PATCH') {
      const input = parseUpdateCountryInput(requestBody.value);
      if (!input) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid payload' }));
        return;
      }

      await pool.query(
        `UPDATE visited_countries SET notes = $1, visit_date = $2, rating = $3, tags = $4
         WHERE user_id = $5 AND country_code = $6 AND country_name = $7`,
        [input.notes, input.visitDate, input.rating, input.tags, userId, input.code, input.name]
      );

      res.statusCode = 204;
      res.end();
      return;
    }

    if (method === 'DELETE') {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const reset = url.searchParams.get('reset');

      if (reset === 'true') {
        await pool.query(`DELETE FROM visited_countries WHERE user_id = $1`, [userId]);
        res.statusCode = 204;
        res.end();
        return;
      }

      const identity = parseCountryIdentity(requestBody.value);
      if (!identity) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid payload' }));
        return;
      }

      await pool.query(
        `DELETE FROM visited_countries
         WHERE user_id = $1 AND country_code = $2 AND country_name = $3`,
        [userId, identity.code, identity.name]
      );

      res.statusCode = 204;
      res.end();
      return;
    }

    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  } catch (err) {
    console.error('countries api error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Failed to process request' }));
    }
  }
}
