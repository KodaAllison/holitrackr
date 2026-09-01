import 'dotenv/config'
import { authConfig } from '../src/lib/auth'
import { runDatabaseMigrations } from '../src/server/databaseMigrations'

try {
  await runDatabaseMigrations()
  console.log('Database migrations complete')
} catch (error) {
  console.error('Database migration failed:', error)
  process.exitCode = 1
} finally {
  await authConfig.database.end()
}
