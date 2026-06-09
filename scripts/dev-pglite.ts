/**
 * Dev launcher: runs an embedded Postgres (PGlite/WASM) over a Postgres-wire
 * TCP socket and starts the API pointed at it. Dev only; the app build never
 * references PGlite.
 *
 * Usage: pnpm dev:pglite
 * Env: PGLITE_PORT (5433), PGLITE_DATA_DIR (`memory` = ephemeral, default
 *      `.pglite`), PGLITE_FRESH=1 (wipe the data dir first)
 */
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import process from 'node:process'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PGLITE_PORT ?? 5433)
const rawDataDir = process.env.PGLITE_DATA_DIR ?? '.pglite'
const ephemeral = rawDataDir === 'memory' || rawDataDir === ''
const dataDir = ephemeral ? undefined : rawDataDir

function log(message: string): void {
  process.stdout.write(`\x1b[35m[pglite]\x1b[0m ${message}\n`)
}

async function main(): Promise<void> {
  if (process.env.PGLITE_FRESH === '1' && dataDir) {
    rmSync(dataDir, { recursive: true, force: true })
    log(`wiped ${dataDir}`)
  }

  log(`starting embedded postgres (${ephemeral ? 'in-memory' : `dataDir: ${dataDir}`})`)
  // pgcrypto: required by the migrations, not bundled in PGlite by default.
  const db = new PGlite({ dataDir, extensions: { pgcrypto } })
  await db.query('select 1') // warm up the WASM engine

  const server = new PGLiteSocketServer({ db, host: HOST, port: PORT })
  await server.start()

  const databaseUrl = `postgres://postgres@${HOST}:${PORT}/postgres`
  log(`postgres-wire server ready on ${HOST}:${PORT}`)
  log(`starting API with DATABASE_URL=${databaseUrl} (PG_POOL_MAX=1)`)

  // PG_POOL_MAX=1: PGlite is a single instance, so one connection keeps
  // transactions serialized. Injected env wins over the app's .env.
  const child = spawn('pnpm', ['--filter', '@multi-wa/api', 'dev'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl, PG_POOL_MAX: '1' }
  })

  let shuttingDown = false
  const shutdown = async (code: number): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    await server.stop().catch(() => undefined)
    await db.close().catch(() => undefined)
    process.exit(code)
  }

  child.on('exit', (code) => void shutdown(code ?? 0))
  child.on('error', (error) => {
    process.stderr.write(`[pglite] failed to spawn API: ${String(error)}\n`)
    void shutdown(1)
  })
  process.on('SIGINT', () => child.kill('SIGINT'))
  process.on('SIGTERM', () => child.kill('SIGTERM'))
}

main().catch((error) => {
  process.stderr.write(`[pglite] failed to start: ${String(error)}\n`)
  process.exit(1)
})
