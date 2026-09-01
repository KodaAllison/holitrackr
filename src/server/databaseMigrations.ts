import { getMigrations } from 'better-auth/db'
import { authConfig } from '../lib/auth'

export async function runDatabaseMigrations(): Promise<void> {
  const { runMigrations } = await getMigrations(authConfig)
  await runMigrations()

  const database = authConfig.database
  await database.query(`
    CREATE TABLE IF NOT EXISTS visited_countries (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      country_code TEXT NOT NULL,
      country_name TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'visited',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, country_code, country_name)
    )
  `)
  await database.query(`
    ALTER TABLE visited_countries ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'visited'
  `)
  await database.query(`
    ALTER TABLE visited_countries ADD COLUMN IF NOT EXISTS notes TEXT
  `)
  await database.query(`
    ALTER TABLE visited_countries ADD COLUMN IF NOT EXISTS visit_date DATE
  `)
  await database.query(`
    ALTER TABLE visited_countries ADD COLUMN IF NOT EXISTS rating INTEGER
  `)
  await database.query(`
    ALTER TABLE visited_countries ADD COLUMN IF NOT EXISTS tags TEXT
  `)
  await database.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS visited_countries_user_id_country_code_country_name_key
    ON visited_countries (user_id, country_code, country_name)
  `)
  await database.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'visited_countries_status_check'
          AND conrelid = 'visited_countries'::regclass
      ) THEN
        ALTER TABLE visited_countries
          ADD CONSTRAINT visited_countries_status_check
          CHECK (status IN ('visited', 'bucketlist')) NOT VALID;
      END IF;
    END
    $$
  `)
  await database.query(`
    ALTER TABLE visited_countries
      VALIDATE CONSTRAINT visited_countries_status_check
  `)
}
