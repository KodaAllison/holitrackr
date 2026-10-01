import type { IncomingMessage, ServerResponse } from 'http';
import {
  parseCountryIdentity,
  parseCreateCountryInput,
  parseUpdateCountryInput,
} from '../src/server/countryPayloads.js';
import {
  deleteCountry,
  listCountries,
  resetCountries,
} from '../src/server/countryVisits.js';
import {
  database,
  pool,
  readRequestBody,
  sendJson,
  sessionUserId,
} from '../src/server/vercelApi.js';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  try {
    const method = (req.method ?? '').toUpperCase();

    const requestBody = await readRequestBody(req);
    if (!requestBody.success) {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }

    // Require Better Auth session for all /api/countries routes.
    const userId = await sessionUserId(req);
    if (!userId) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    if (method === 'GET') {
      sendJson(res, 200, await listCountries(database, userId));
      return;
    }

    if (method === 'POST') {
      const parsed = parseCreateCountryInput(requestBody.value);
      if (!parsed.success) {
        sendJson(res, 400, { error: parsed.error });
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

      sendJson(res, 204);
      return;
    }

    if (method === 'PATCH') {
      const input = parseUpdateCountryInput(requestBody.value);
      if (!input) {
        sendJson(res, 400, { error: 'Invalid payload' });
        return;
      }

      await pool.query(
        `UPDATE visited_countries SET notes = $1, place = $2, visit_date = $3, rating = $4, tags = $5
         WHERE user_id = $6 AND country_code = $7 AND country_name = $8`,
        [input.notes, input.place, input.visitDate, input.rating, input.tags, userId, input.code, input.name]
      );

      sendJson(res, 204);
      return;
    }

    if (method === 'DELETE') {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const reset = url.searchParams.get('reset');

      if (reset === 'true') {
        await resetCountries(database, userId);
        sendJson(res, 204);
        return;
      }

      const identity = parseCountryIdentity(requestBody.value);
      if (!identity) {
        sendJson(res, 400, { error: 'Invalid payload' });
        return;
      }

      await deleteCountry(database, userId, identity);

      sendJson(res, 204);
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('countries api error:', err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Failed to process request' });
    }
  }
}
