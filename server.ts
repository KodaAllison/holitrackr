import 'dotenv/config';
import express from 'express';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { createServer as createViteServer } from 'vite';
import { auth, authConfig } from './src/lib/auth';
import {
  parseCountryIdentity,
  parseCreateCountryInput,
  parseStoredStatus,
  parseStoredTags,
  parseUpdateCountryInput,
} from './src/server/countryPayloads';
import { runDatabaseMigrations } from './src/server/databaseMigrations';
import { handlePublicStatsRequest } from './src/server/publicStats';
import type { StoredCountryRow, VisitedCountryDto } from './src/types/countriesApi';
import type { PublicCountryRow } from './src/types/publicStats';

function isMalformedJsonError(error: unknown): error is SyntaxError & { status: 400 } {
  return error instanceof SyntaxError && 'status' in error && error.status === 400;
}

async function createServer() {
  const app = express();

  try {
    await runDatabaseMigrations();
    console.log('Database migrations complete');
  } catch (err) {
    console.error('Database migration failed — aborting startup:', err);
    process.exit(1);
  }

  // Better Auth API routes - Express v5 uses *splat for catch-all
  const authHandler = toNodeHandler(auth);
  app.all("/api/auth/*splat", async (req, res) => {
    try {
      await authHandler(req, res);
    } catch (err) {
      console.error('Auth error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Authentication failed' });
      }
    }
  });

  app.all('/api/public/stats', async (req, res) => {
    const response = await handlePublicStatsRequest({
      method: req.method,
      origin: req.headers.origin,
      ownerUserId: process.env.PUBLIC_STATS_OWNER_USER_ID,
      database: {
        query: async (statement, parameters) => {
          const result = await authConfig.database.query<PublicCountryRow>(statement, parameters);
          return { rows: result.rows };
        },
      },
    });

    for (const [name, value] of Object.entries(response.headers)) {
      res.setHeader(name, value);
    }

    if (response.body) return res.status(response.status).json(response.body);
    return res.status(response.status).end();
  });

  // For authenticated custom routes only. Keeping this after the public route ensures
  // malformed request bodies cannot bypass the public handler's CORS and cache headers.
  app.use(express.json());

  app.get('/api/countries', async (req, res) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const userId = session?.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await authConfig.database.query<StoredCountryRow>(
      `SELECT country_code, country_name, status, notes, visit_date, rating, tags
       FROM visited_countries
       WHERE user_id = $1
       ORDER BY visit_date DESC NULLS LAST, created_at DESC`,
      [userId]
    );

    return res.json(
      rows.map((r): VisitedCountryDto => {
        return {
          code: r.country_code,
          name: r.country_name,
          status: parseStoredStatus(r.status),
          notes: r.notes ?? undefined,
          visitedAt: r.visit_date ? r.visit_date.slice(0, 7) : undefined,
          rating: r.rating ?? undefined,
          tags: parseStoredTags(r.tags),
        }
      })
    );
  });

  app.post('/api/countries', async (req, res) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const userId = session?.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = parseCreateCountryInput(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error });
    }
    const { code, name, status, notes } = parsed.value;

    await authConfig.database.query(
      `INSERT INTO visited_countries (user_id, country_code, country_name, status, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, country_code, country_name) DO UPDATE
         SET status = EXCLUDED.status,
             notes = COALESCE(EXCLUDED.notes, visited_countries.notes)`,
      [userId, code, name, status, notes]
    );

    return res.status(204).end();
  });

  app.patch('/api/countries', async (req, res) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const userId = session?.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const input = parseUpdateCountryInput(req.body);
    if (!input) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    await authConfig.database.query(
      `UPDATE visited_countries SET notes = $1, visit_date = $2, rating = $3, tags = $4
       WHERE user_id = $5 AND country_code = $6 AND country_name = $7`,
      [input.notes, input.visitDate, input.rating, input.tags, userId, input.code, input.name]
    );

    return res.status(204).end();
  });

  app.delete('/api/countries', async (req, res) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const userId = session?.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const reset = req.query.reset;
    const pool = authConfig.database;

    if (reset === 'true') {
      await pool.query(`DELETE FROM visited_countries WHERE user_id = $1`, [userId]);
      return res.status(204).end();
    }

    const identity = parseCountryIdentity(req.body);
    if (!identity) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    await pool.query(
      `DELETE FROM visited_countries
       WHERE user_id = $1 AND country_code = $2 AND country_name = $3`,
      [userId, identity.code, identity.name]
    );

    return res.status(204).end();
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (isMalformedJsonError(error)) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    return next(error);
  });

  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const port = Number(process.env.PORT) || 5173;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

createServer();
