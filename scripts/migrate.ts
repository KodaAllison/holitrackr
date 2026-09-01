import 'dotenv/config'

const configuredDatabaseUrl = process.env.DATABASE_URL
if (!configuredDatabaseUrl) throw new Error('Missing DATABASE_URL')

const migrationDatabaseUrl = new URL(configuredDatabaseUrl)
if (migrationDatabaseUrl.hostname.includes('-pooler')) {
  migrationDatabaseUrl.hostname = migrationDatabaseUrl.hostname.replace('-pooler', '')
  process.env.DATABASE_URL = migrationDatabaseUrl.toString()
  console.log('Using a direct Neon connection for database migrations')
}

const [{ authConfig }, { runDatabaseMigrations }] = await Promise.all([
  import('../src/lib/auth'),
  import('../src/server/databaseMigrations'),
])

try {
  await runDatabaseMigrations()
  console.log('Database migrations complete')
} catch (error) {
  console.error('Database migration failed:', error)
  process.exitCode = 1
} finally {
  await authConfig.database.end()
}
