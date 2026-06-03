import type { EngineEvent } from '@multi-wa/types'
import { request } from 'undici'
import { hmacSign } from '../lib/crypto'
import type { Logger } from '../lib/logger'
import type { WebhookRepository, WebhookTarget } from './repository'

interface CachedTargets {
  targets: WebhookTarget[]
  expiresAt: number
}

export interface WebhookDispatcherOptions {
  timeoutMs: number
  maxRetries: number
  cacheTtlMs?: number
}

export class WebhookDispatcher {
  private readonly cache = new Map<string, CachedTargets>()
  private readonly cacheTtlMs: number

  constructor(
    private readonly repository: WebhookRepository,
    private readonly logger: Logger,
    private readonly options: WebhookDispatcherOptions
  ) {
    this.cacheTtlMs = options.cacheTtlMs ?? 5000
  }

  invalidate(tenantId: string): void {
    this.cache.delete(tenantId)
  }

  dispatch(tenantId: string, sessionId: string, event: EngineEvent): void {
    void this.deliverAll(tenantId, sessionId, event)
  }

  private async resolveTargets(tenantId: string): Promise<WebhookTarget[]> {
    const cached = this.cache.get(tenantId)
    if (cached && cached.expiresAt > nowMs()) return cached.targets
    const targets = await this.repository.listActiveTargets(tenantId)
    this.cache.set(tenantId, { targets, expiresAt: nowMs() + this.cacheTtlMs })
    return targets
  }

  private async deliverAll(
    tenantId: string,
    sessionId: string,
    event: EngineEvent
  ): Promise<void> {
    let targets: WebhookTarget[]
    try {
      targets = await this.resolveTargets(tenantId)
    } catch (error) {
      this.logger.warn({ err: error, tenantId }, 'failed to load webhook targets')
      return
    }
    const subscribed = targets.filter((target) => target.events.includes(event.type))
    await Promise.all(
      subscribed.map((target) => this.deliver(target, sessionId, event))
    )
  }

  private async deliver(
    target: WebhookTarget,
    sessionId: string,
    event: EngineEvent
  ): Promise<void> {
    const body = JSON.stringify({ sessionId, event })
    const signature = hmacSign(target.secret, body)
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      try {
        const response = await request(target.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-signature': `sha256=${signature}`,
            'x-event-type': event.type,
            'x-session-id': sessionId
          },
          body,
          headersTimeout: this.options.timeoutMs,
          bodyTimeout: this.options.timeoutMs
        })
        await response.body.dump()
        if (response.statusCode < 400) return
        if (response.statusCode < 500) {
          this.logger.warn(
            { webhook: target.id, status: response.statusCode },
            'webhook rejected delivery'
          )
          return
        }
      } catch (error) {
        this.logger.debug({ err: error, webhook: target.id, attempt }, 'webhook delivery failed')
      }
      if (attempt < this.options.maxRetries) {
        await delay(backoffMs(attempt))
      }
    }
    this.logger.warn({ webhook: target.id }, 'webhook delivery exhausted retries')
  }
}

function nowMs(): number {
  return Number(process.hrtime.bigint() / 1_000_000n)
}

function backoffMs(attempt: number): number {
  return Math.min(30000, 500 * 2 ** attempt)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
