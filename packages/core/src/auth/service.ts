import type { ApiKey, ApiKeyCreated } from '@multi-wa/types'
import { constantTimeEqual, hashPassword, randomToken, sha256, verifyPassword } from '../lib/crypto'
import { errors } from '../lib/errors'
import type { ApiKeyRepository, RefreshTokenRepository, UserRepository } from './repository'

export interface Principal {
  userId: string
  tenantId: string
}

export interface RefreshRotation {
  userId: string
  tenantId: string
  token: string
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly apiKeys: ApiKeyRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly refreshTtlSeconds: number
  ) {}

  async verifyCredentials(email: string, password: string): Promise<Principal> {
    const user = await this.users.findByEmail(email)
    if (!user) {
      await hashPassword(password)
      throw errors.unauthorized('invalid credentials')
    }
    const valid = await verifyPassword(user.passwordHash, password)
    if (!valid) throw errors.unauthorized('invalid credentials')
    return { userId: user.id, tenantId: user.tenantId }
  }

  async authenticateApiKey(rawKey: string): Promise<Principal | null> {
    const separator = rawKey.indexOf('.')
    if (separator <= 0) return null
    const prefix = rawKey.slice(0, separator)
    const secret = rawKey.slice(separator + 1)
    const record = await this.apiKeys.findByPrefix(prefix)
    if (!record || record.revoked) return null
    if (!constantTimeEqual(sha256(secret), record.keyHash)) return null
    await this.apiKeys.touch(record.id)
    return { userId: record.id, tenantId: record.tenantId }
  }

  async createApiKey(tenantId: string, name: string): Promise<ApiKeyCreated> {
    const prefix = randomToken(6)
    const secret = randomToken(24)
    const created = await this.apiKeys.create(tenantId, name, prefix, sha256(secret))
    return { ...created, key: `${prefix}.${secret}` }
  }

  async listApiKeys(tenantId: string): Promise<ApiKey[]> {
    return this.apiKeys.list(tenantId)
  }

  async revokeApiKey(tenantId: string, id: string): Promise<void> {
    const revoked = await this.apiKeys.revoke(tenantId, id)
    if (!revoked) throw errors.notFound('api key not found')
  }

  async issueRefreshToken(userId: string): Promise<string> {
    const token = randomToken(32)
    const expiresAt = new Date(Date.now() + this.refreshTtlSeconds * 1000)
    await this.refreshTokens.create(userId, sha256(token), expiresAt)
    return token
  }

  async rotateRefreshToken(token: string): Promise<RefreshRotation> {
    const record = await this.refreshTokens.find(sha256(token))
    if (!record || record.revoked || record.expiresAt.getTime() <= Date.now()) {
      throw errors.unauthorized('invalid refresh token')
    }
    await this.refreshTokens.revoke(record.id)
    const tenantId = await this.tenantForUser(record.userId)
    const next = await this.issueRefreshToken(record.userId)
    return { userId: record.userId, tenantId, token: next }
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const record = await this.refreshTokens.find(sha256(token))
    if (record && !record.revoked) await this.refreshTokens.revoke(record.id)
  }

  async ensureBootstrapUser(tenantName: string, email: string, password: string): Promise<void> {
    const existing = await this.users.findByEmail(email)
    if (existing) return
    await this.users.createTenantWithUser(tenantName, email, await hashPassword(password))
  }

  private async tenantForUser(userId: string): Promise<string> {
    const tenantId = await this.users.findTenantByUserId(userId)
    if (!tenantId) throw errors.unauthorized('user no longer exists')
    return tenantId
  }
}
