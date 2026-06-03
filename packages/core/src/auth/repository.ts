import type { Pool } from '@multi-wa/db'
import type { ApiKey } from '@multi-wa/types'

export interface UserRecord {
  id: string
  tenantId: string
  passwordHash: string
  role: string
}

export class UserRepository {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await this.pool.query<{
      id: string
      tenant_id: string
      password_hash: string
      role: string
    }>(`SELECT id, tenant_id, password_hash, role FROM users WHERE email = $1`, [email])
    const row = rows[0]
    if (!row) return null
    return {
      id: row.id,
      tenantId: row.tenant_id,
      passwordHash: row.password_hash,
      role: row.role
    }
  }

  async findTenantByUserId(userId: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM users WHERE id = $1`,
      [userId]
    )
    return rows[0]?.tenant_id ?? null
  }

  async createTenantWithUser(
    tenantName: string,
    email: string,
    passwordHash: string
  ): Promise<UserRecord> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const tenant = await client.query<{ id: string }>(
        `INSERT INTO tenants (name) VALUES ($1) RETURNING id`,
        [tenantName]
      )
      const tenantId = tenant.rows[0]!.id
      const user = await client.query<{ id: string }>(
        `INSERT INTO users (tenant_id, email, password_hash, role)
         VALUES ($1, $2, $3, 'admin') RETURNING id`,
        [tenantId, email, passwordHash]
      )
      await client.query('COMMIT')
      return { id: user.rows[0]!.id, tenantId, passwordHash, role: 'admin' }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

export interface ApiKeyRecord {
  id: string
  tenantId: string
  keyHash: string
  revoked: boolean
}

interface ApiKeyRow {
  id: string
  name: string
  prefix: string
  created_at: Date
  last_used_at: Date | null
}

function toApiKey(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.created_at.toISOString(),
    lastUsedAt: row.last_used_at ? row.last_used_at.toISOString() : null
  }
}

export class ApiKeyRepository {
  constructor(private readonly pool: Pool) {}

  async create(
    tenantId: string,
    name: string,
    prefix: string,
    keyHash: string
  ): Promise<ApiKey> {
    const { rows } = await this.pool.query<ApiKeyRow>(
      `INSERT INTO api_keys (tenant_id, name, prefix, key_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, prefix, created_at, last_used_at`,
      [tenantId, name, prefix, keyHash]
    )
    return toApiKey(rows[0]!)
  }

  async list(tenantId: string): Promise<ApiKey[]> {
    const { rows } = await this.pool.query<ApiKeyRow>(
      `SELECT id, name, prefix, created_at, last_used_at
       FROM api_keys WHERE tenant_id = $1 AND revoked = false ORDER BY created_at DESC`,
      [tenantId]
    )
    return rows.map(toApiKey)
  }

  async findByPrefix(prefix: string): Promise<ApiKeyRecord | null> {
    const { rows } = await this.pool.query<{
      id: string
      tenant_id: string
      key_hash: string
      revoked: boolean
    }>(`SELECT id, tenant_id, key_hash, revoked FROM api_keys WHERE prefix = $1`, [prefix])
    const row = rows[0]
    if (!row) return null
    return { id: row.id, tenantId: row.tenant_id, keyHash: row.key_hash, revoked: row.revoked }
  }

  async touch(id: string): Promise<void> {
    await this.pool.query(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [id])
  }

  async revoke(tenantId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE api_keys SET revoked = true WHERE tenant_id = $1 AND id = $2 AND revoked = false`,
      [tenantId, id]
    )
    return (result.rowCount ?? 0) > 0
  }
}

export interface RefreshTokenRecord {
  id: string
  userId: string
  expiresAt: Date
  revoked: boolean
}

export class RefreshTokenRepository {
  constructor(private readonly pool: Pool) {}

  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    )
  }

  async find(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const { rows } = await this.pool.query<{
      id: string
      user_id: string
      expires_at: Date
      revoked: boolean
    }>(`SELECT id, user_id, expires_at, revoked FROM refresh_tokens WHERE token_hash = $1`, [
      tokenHash
    ])
    const row = rows[0]
    if (!row) return null
    return {
      id: row.id,
      userId: row.user_id,
      expiresAt: row.expires_at,
      revoked: row.revoked
    }
  }

  async revoke(id: string): Promise<void> {
    await this.pool.query(`UPDATE refresh_tokens SET revoked = true WHERE id = $1`, [id])
  }
}
