import 'dotenv/config';
import express from 'express';
import type { QueryResultRow } from 'pg';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { createServer as createViteServer } from 'vite';
import { auth, authConfig } from './src/lib/auth';
import { handleCountriesRequest } from './src/server/countriesRequest';
import { handleCountryVisitsRequest, type CountriesDatabase } from './src/server/countryVisits';
import { runDatabaseMigrations } from './src/server/databaseMigrations';
import { handlePublicStatsRequest } from './src/server/publicStats';
import type { PublicCountryRow } from './src/types/publicStats';

function isMalformedJsonError(error: unknown): error is SyntaxError & { status: 400 } {
  return error instanceof SyntaxError && 'status' in error && error.status === 400;
}

const database: CountriesDatabase = {
  query: <Row extends QueryResultRow>(statement: string, parameters: unknown[]) =>
    authConfig.database.query<Row>(statement, parameters),
};

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

  // A country's extra visits (FEATURES.md #8); logic shared with api/countries/visits.ts.
  app.all('/api/countries/visits', async (req, res) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const response = await handleCountryVisitsRequest({
      method: req.method,
      userId: session?.user?.id,
      body: req.body,
      database,
    });

    if (response.body) return res.status(response.status).json(response.body);
    return res.status(response.status).end();
  });

  // The user's atlas; logic shared with api/countries.ts.
  app.all('/api/countries', async (req, res) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const response = await handleCountriesRequest({
      method: req.method,
      userId: session?.user?.id,
      body: req.body,
      reset: req.query.reset === 'true',
      database,
    });

    if (response.body) return res.status(response.status).json(response.body);
    return res.status(response.status).end();
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
