import pg from 'pg'

// Integration-test pool. url "pglite" runs an in-memory Postgres (PGlite),
// loaded only then; otherwise a normal pg.Pool against the url.
export async function createTestPool(url: string): Promise<pg.Pool> {
  if (!url.startsWith('pglite')) {
    return new pg.Pool({ connectionString: url })
  }

  const { PGlite } = await import('@electric-sql/pglite')
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto')
  const db = new PGlite({ extensions: { pgcrypto } })

  // Single shared session, so callers must stay sequential (tests are) to keep
  // BEGIN/COMMIT from interleaving. No params: exec (simple protocol) for the
  // multi-statement migrations; with params: query (prepared). affectedRows is
  // 0 on SELECT, so fall back to rows.length to match pg's rowCount.
  const query = async (text: string, params?: unknown[]) => {
    if (params && params.length > 0) {
      const r = await db.query(text, params)
      return { rows: r.rows, rowCount: r.affectedRows || r.rows.length }
    }
    const last = (await db.exec(text)).at(-1)
    return { rows: last?.rows ?? [], rowCount: last?.affectedRows || last?.rows.length || 0 }
  }

  const adapter = {
    query,
    connect: async () => ({ query, release: () => {} }),
    end: () => db.close()
  }
  return adapter as unknown as pg.Pool
}
