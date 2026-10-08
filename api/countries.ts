import type { IncomingMessage, ServerResponse } from 'http';
import { handleCountriesRequest } from '../src/server/countriesRequest.js';
import {
  database,
  readRequestBody,
  sendJson,
  sessionUserId,
} from '../src/server/vercelApi.js';

/** GET / POST / PATCH / DELETE /api/countries: the user's atlas. */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  try {
    const requestBody = await readRequestBody(req);
    if (!requestBody.success) {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }

    const url = new URL(req.url ?? '/', 'http://localhost');
    const response = await handleCountriesRequest({
      method: req.method ?? '',
      userId: await sessionUserId(req),
      body: requestBody.value,
      reset: url.searchParams.get('reset') === 'true',
      database,
    });
    sendJson(res, response.status, response.body);
  } catch (err) {
    console.error('countries api error:', err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Failed to process request' });
    }
  }
}
