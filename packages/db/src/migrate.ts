import type { Pool } from 'pg'
import { migrations } from './migrations/index'

export async function runMigrations(pool: Pool): Promise<string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS _migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`
  )

  const { rows } = await pool.query<{ id: string }>('SELECT id FROM _migrations')
  const applied = new Set(rows.map((row) => row.id))
  const executed: string[] = []

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(migration.sql)
      await client.query('INSERT INTO _migrations (id) VALUES ($1)', [migration.id])
      await client.query('COMMIT')
      executed.push(migration.id)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  return executed
}
