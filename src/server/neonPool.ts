import { neonConfig, Pool } from '@neondatabase/serverless'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

export function createNeonPool(connectionString: string): Pool {
  return new Pool({ connectionString })
}
