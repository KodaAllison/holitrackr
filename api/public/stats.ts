import { Pool } from '@neondatabase/serverless'
import type { IncomingMessage, ServerResponse } from 'http'
import {
  handlePublicStatsRequest,
  type PublicCountryRow,
  type PublicStatsDatabase,
} from '../../src/server/publicStats'

let pool: Pool | undefined

function getPool(): Pool {
  if (pool) return pool

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('Missing DATABASE_URL')

  pool = new Pool({
    connectionString: databaseUrl.replace(/[&?]channel_binding=[^&]*/g, ''),
  })
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
