import { betterAuth } from 'better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import { Pool } from '@neondatabase/serverless';
import type { IncomingMessage, ServerResponse } from 'http';

async function readRequestBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
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

const pool = new Pool({ connectionString: cleanUrl });

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
      const { rows } = await pool.query<{ country_code: string; country_name: string }>(
        `SELECT country_code, country_name
         FROM visited_countries
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify(
          rows.map((r) => ({
            code: r.country_code,
            name: r.country_name,
          }))
        )
      );
      return;
    }

    if (method === 'POST') {
      const body = (await readRequestBody(req)) as
        | { code?: unknown; name?: unknown }
        | null;

      const code = body?.code;
      const name = body?.name;
      if (typeof code !== 'string' || typeof name !== 'string') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid payload' }));
        return;
      }

      await pool.query(
        `INSERT INTO visited_countries (user_id, country_code, country_name)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [userId, code, name]
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

      const body = (await readRequestBody(req)) as
        | { code?: unknown; name?: unknown }
        | null;

      const code = body?.code;
      const name = body?.name;
      if (typeof code !== 'string' || typeof name !== 'string') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid payload' }));
        return;
      }

      await pool.query(
        `DELETE FROM visited_countries
         WHERE user_id = $1 AND country_code = $2 AND country_name = $3`,
        [userId, code, name]
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

