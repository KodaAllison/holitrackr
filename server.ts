import 'dotenv/config';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { getMigrations } from 'better-auth/db';
import { createServer as createViteServer } from 'vite';
import { auth, authConfig } from './src/lib/auth';

async function createServer() {
  const app = express();

  // Run database migrations so tables exist
  try {
    const { runMigrations } = await getMigrations(authConfig);
    await runMigrations();
    console.log('Database migrations complete');
  } catch (err) {
    console.warn('Migration:', err);
  }

  // Better Auth API routes - Express v5 uses *splat for catch-all
  const authHandler = toNodeHandler(auth);
  app.all("/api/auth/*splat", async (req, res) => {
    try {
      await authHandler(req, res);
    } catch (err) {
      console.error('Auth error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Auth failed' });
      }
    }
  });

  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  // Use vite's connect instance as middleware
  app.use(vite.middlewares);

  const port = 5173;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

createServer();
