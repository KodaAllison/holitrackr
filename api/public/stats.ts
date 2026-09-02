import type { IncomingMessage, ServerResponse } from 'http'
import { createNeonPool } from '../../src/server/neonPool.js'
import {
  handlePublicStatsRequest,
} from '../../src/server/publicStats.js'
import type {
  PublicCountryRow,
  PublicStatsDatabase,
} from '../../src/types/publicStats.js'

let pool: ReturnType<typeof createNeonPool> | undefined

function getPool(): ReturnType<typeof createNeonPool> {
  if (pool) return pool

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('Missing DATABASE_URL')

  pool = createNeonPool(databaseUrl.replace(/[&?]channel_binding=[^&]*/g, ''))
  return pool
}

const database: PublicStatsDatabase = {
  query: async (statement, parameters) => {
    const result = await getPool().query<PublicCountryRow>(statement, parameters)
    return { rows: result.rows }
  },
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const response = await handlePublicStatsRequest({
    method: req.method ?? '',
    origin: typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
    ownerUserId: process.env.PUBLIC_STATS_OWNER_USER_ID,
    database,
  })

  res.statusCode = response.status
  for (const [name, value] of Object.entries(response.headers)) {
    res.setHeader(name, value)
  }

  if (response.body) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(response.body))
    return
  }

  res.end()
}
