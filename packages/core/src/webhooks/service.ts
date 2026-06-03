import type { CreateWebhookInput, Webhook, WebhookCreated } from '@multi-wa/types'
import { randomToken } from '../lib/crypto'
import { errors } from '../lib/errors'
import type { WebhookDispatcher } from './dispatcher'
import type { WebhookRepository } from './repository'

export class WebhookService {
  constructor(
    private readonly repository: WebhookRepository,
    private readonly dispatcher: WebhookDispatcher
  ) {}

  async create(tenantId: string, input: CreateWebhookInput): Promise<WebhookCreated> {
    const secret = input.secret ?? randomToken(24)
    const webhook = await this.repository.create(tenantId, input, secret)
    this.dispatcher.invalidate(tenantId)
    return { ...webhook, secret }
  }

  async list(tenantId: string): Promise<Webhook[]> {
    return this.repository.list(tenantId)
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const deleted = await this.repository.delete(tenantId, id)
    if (!deleted) throw errors.notFound('webhook not found')
    this.dispatcher.invalidate(tenantId)
  }
}
