import 'dotenv/config';
import express from 'express';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { getMigrations } from 'better-auth/db';
import { createServer as createViteServer } from 'vite';
import { auth, authConfig } from './src/lib/auth';

async function createServer() {
  const app = express();

  try {
    const { runMigrations } = await getMigrations(authConfig);
    await runMigrations();
    console.log('Database migrations complete');

    // Ensure our app table exists in dev as well.
    const pool = authConfig.database;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS visited_countries (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        country_code TEXT NOT NULL,
        country_name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, country_code, country_name)
      );
    `);
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

  // For our custom routes only (Better Auth recommends not running json middleware before its handler).
  app.use(express.json());

  app.get('/api/countries', async (req, res) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const userId = session?.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await authConfig.database.query<{ country_code: string; country_name: string }>(
      `SELECT country_code, country_name
       FROM visited_countries
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json(
      rows.map((r) => ({
        code: r.country_code,
        name: r.country_name,
      }))
    );
  });

  app.post('/api/countries', async (req, res) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const userId = session?.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { code, name } = (req.body ?? {}) as { code?: unknown; name?: unknown };
    if (typeof code !== 'string' || typeof name !== 'string') {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    await authConfig.database.query(
      `INSERT INTO visited_countries (user_id, country_code, country_name)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [userId, code, name]
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

    const { code, name } = (req.body ?? {}) as { code?: unknown; name?: unknown };
    if (typeof code !== 'string' || typeof name !== 'string') {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    await pool.query(
      `DELETE FROM visited_countries
       WHERE user_id = $1 AND country_code = $2 AND country_name = $3`,
      [userId, code, name]
    );

    return res.status(204).end();
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
