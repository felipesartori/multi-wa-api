import { runMigrations } from './migrate'
import { closePool, getPool } from './pool'

async function main(): Promise<void> {
  const pool = getPool()
  const executed = await runMigrations(pool)
  await closePool()
  if (executed.length === 0) {
    process.stdout.write('migrations: nothing to apply\n')
    return
  }
  process.stdout.write(`migrations applied: ${executed.join(', ')}\n`)
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`)
  process.exit(1)
})
