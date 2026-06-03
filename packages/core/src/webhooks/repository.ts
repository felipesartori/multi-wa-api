import type { Pool } from '@multi-wa/db'
import type { CreateWebhookInput, Webhook, WebhookEventType } from '@multi-wa/types'

interface WebhookRow {
  id: string
  url: string
  secret: string
  events: WebhookEventType[]
  active: boolean
  created_at: Date
}

export interface WebhookTarget {
  id: string
  url: string
  secret: string
  events: WebhookEventType[]
}

function toWebhook(row: WebhookRow): Webhook {
  return {
    id: row.id,
    url: row.url,
    events: row.events,
    active: row.active,
    createdAt: row.created_at.toISOString()
  }
}

export class WebhookRepository {
  constructor(private readonly pool: Pool) {}

  async create(tenantId: string, input: CreateWebhookInput, secret: string): Promise<Webhook> {
    const { rows } = await this.pool.query<WebhookRow>(
      `INSERT INTO webhooks (tenant_id, url, secret, events)
       VALUES ($1, $2, $3, $4)
       RETURNING id, url, secret, events, active, created_at`,
      [tenantId, input.url, secret, input.events]
    )
    return toWebhook(rows[0]!)
  }

  async list(tenantId: string): Promise<Webhook[]> {
    const { rows } = await this.pool.query<WebhookRow>(
      `SELECT id, url, secret, events, active, created_at
       FROM webhooks WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    )
    return rows.map(toWebhook)
  }

  async listActiveTargets(tenantId: string): Promise<WebhookTarget[]> {
    const { rows } = await this.pool.query<WebhookRow>(
      `SELECT id, url, secret, events FROM webhooks WHERE tenant_id = $1 AND active = true`,
      [tenantId]
    )
    return rows.map((row) => ({
      id: row.id,
      url: row.url,
      secret: row.secret,
      events: row.events
    }))
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM webhooks WHERE tenant_id = $1 AND id = $2`, [
      tenantId,
      id
    ])
    return (result.rowCount ?? 0) > 0
  }
}
