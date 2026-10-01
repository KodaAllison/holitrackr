import type { IncomingMessage, ServerResponse } from 'http';
import { handleCountryVisitsRequest } from '../../src/server/countryVisits.js';
import {
  database,
  readRequestBody,
  sendJson,
  sessionUserId,
} from '../../src/server/vercelApi.js';

/** POST / PATCH / DELETE /api/countries/visits: a country's extra visits. */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const requestBody = await readRequestBody(req);
    if (!requestBody.success) {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }

    const response = await handleCountryVisitsRequest({
      method: req.method ?? '',
      userId: await sessionUserId(req),
      body: requestBody.value,
      database,
    });
    sendJson(res, response.status, response.body);
  } catch (err) {
    console.error('country visits api error:', err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Failed to process request' });
    }
  }
}
