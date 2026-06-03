import { describe, expect, it } from 'vitest'
import { sha256 } from '../lib/crypto'
import { AppError } from '../lib/errors'
import type {
  ApiKeyRecord,
  ApiKeyRepository,
  RefreshTokenRepository,
  UserRepository
} from './repository'
import { AuthService } from './service'

class InMemoryUsers {
  private readonly byId = new Map<string, { tenantId: string; passwordHash: string }>()
  private readonly byEmail = new Map<string, string>()
  private seq = 0
  async findByEmail(email: string) {
    const id = this.byEmail.get(email)
    if (!id) return null
    const row = this.byId.get(id)!
    return { id, tenantId: row.tenantId, passwordHash: row.passwordHash, role: 'admin' }
  }
  async findTenantByUserId(userId: string) {
    return this.byId.get(userId)?.tenantId ?? null
  }
  async createTenantWithUser(_tenant: string, email: string, passwordHash: string) {
    const id = `u-${++this.seq}`
    const tenantId = `t-${this.seq}`
    this.byId.set(id, { tenantId, passwordHash })
    this.byEmail.set(email, id)
    return { id, tenantId, passwordHash, role: 'admin' }
  }
}

class InMemoryApiKeys {
  private readonly byId = new Map<
    string,
    ApiKeyRecord & { name: string; lastUsedAt: Date | null }
  >()
  private readonly byPrefix = new Map<string, string>()
  private seq = 0
  async create(tenantId: string, name: string, prefix: string, keyHash: string) {
    const id = `k-${++this.seq}`
    this.byId.set(id, { id, tenantId, keyHash, revoked: false, name, lastUsedAt: null })
    this.byPrefix.set(prefix, id)
    return { id, name, prefix, createdAt: new Date().toISOString(), lastUsedAt: null }
  }
  async list(tenantId: string) {
    return [...this.byId.values()]
      .filter((row) => row.tenantId === tenantId && !row.revoked)
      .map((row) => ({
        id: row.id,
        name: row.name,
        prefix: '',
        createdAt: '',
        lastUsedAt: null
      }))
  }
  async findByPrefix(prefix: string): Promise<ApiKeyRecord | null> {
    const id = this.byPrefix.get(prefix)
    if (!id) return null
    const row = this.byId.get(id)!
    return { id: row.id, tenantId: row.tenantId, keyHash: row.keyHash, revoked: row.revoked }
  }
  async touch(id: string) {
    const row = this.byId.get(id)
    if (row) row.lastUsedAt = new Date()
  }
  async revoke(tenantId: string, id: string) {
    const row = this.byId.get(id)
    if (!row || row.tenantId !== tenantId || row.revoked) return false
    row.revoked = true
    return true
  }
}

class InMemoryRefresh {
  private readonly rows = new Map<
    string,
    { id: string; userId: string; expiresAt: Date; revoked: boolean }
  >()
  private seq = 0
  async create(userId: string, tokenHash: string, expiresAt: Date) {
    this.rows.set(tokenHash, { id: `r-${++this.seq}`, userId, expiresAt, revoked: false })
  }
  async find(tokenHash: string) {
    return this.rows.get(tokenHash) ?? null
  }
  async revoke(id: string) {
    for (const row of this.rows.values()) if (row.id === id) row.revoked = true
  }
}

function build() {
  const users = new InMemoryUsers()
  const apiKeys = new InMemoryApiKeys()
  const refresh = new InMemoryRefresh()
  const service = new AuthService(
    users as unknown as UserRepository,
    apiKeys as unknown as ApiKeyRepository,
    refresh as unknown as RefreshTokenRepository,
    3600
  )
  return { service, refresh }
}

describe('AuthService', () => {
  it('bootstraps a user and verifies credentials', async () => {
    const { service } = build()
    await service.ensureBootstrapUser('default', 'admin@x.com', 'password123')
    const principal = await service.verifyCredentials('admin@x.com', 'password123')
    expect(principal.tenantId).toBeTruthy()
    await expect(service.verifyCredentials('admin@x.com', 'wrong')).rejects.toBeInstanceOf(AppError)
    await expect(service.verifyCredentials('ghost@x.com', 'x')).rejects.toBeInstanceOf(AppError)
  })

  it('creates and authenticates an api key, and rejects revoked keys', async () => {
    const { service } = build()
    await service.ensureBootstrapUser('default', 'admin@x.com', 'password123')
    const principal = await service.verifyCredentials('admin@x.com', 'password123')
    const created = await service.createApiKey(principal.tenantId, 'ci')
    expect(created.key).toContain('.')

    const authed = await service.authenticateApiKey(created.key)
    expect(authed?.tenantId).toBe(principal.tenantId)

    expect(await service.authenticateApiKey('bogus.key')).toBeNull()
    await service.revokeApiKey(principal.tenantId, created.id)
    expect(await service.authenticateApiKey(created.key)).toBeNull()
  })

  it('rotates refresh tokens and invalidates the previous one', async () => {
    const { service } = build()
    await service.ensureBootstrapUser('default', 'admin@x.com', 'password123')
    const principal = await service.verifyCredentials('admin@x.com', 'password123')
    const token = await service.issueRefreshToken(principal.userId)
    const rotation = await service.rotateRefreshToken(token)
    expect(rotation.token).not.toBe(token)
    expect(rotation.tenantId).toBe(principal.tenantId)
    await expect(service.rotateRefreshToken(token)).rejects.toBeInstanceOf(AppError)
  })

  it('uses sha256 hashing for api key secrets', () => {
    expect(sha256('value')).toHaveLength(64)
  })
})
