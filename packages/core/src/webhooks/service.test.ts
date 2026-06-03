import type { CreateWebhookInput, Webhook } from '@multi-wa/types'
import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../lib/errors'
import type { WebhookDispatcher } from './dispatcher'
import type { WebhookRepository } from './repository'
import { WebhookService } from './service'

describe('WebhookService', () => {
  it('generates a secret when none is provided and invalidates the cache', async () => {
    const created: Webhook = {
      id: 'w1',
      url: 'https://x/hook',
      events: ['message'],
      active: true,
      createdAt: new Date().toISOString()
    }
    const repository = {
      create: vi.fn(async (_tenant: string, _input: CreateWebhookInput, _secret: string) => created)
    } as unknown as WebhookRepository
    const invalidate = vi.fn()
    const dispatcher = { invalidate } as unknown as WebhookDispatcher
    const service = new WebhookService(repository, dispatcher)

    const result = await service.create('t1', { url: 'https://x/hook', events: ['message'] })
    expect(result.secret.length).toBeGreaterThan(16)
    expect(invalidate).toHaveBeenCalledWith('t1')
  })

  it('throws notFound when deleting a missing webhook', async () => {
    const repository = { delete: async () => false } as unknown as WebhookRepository
    const dispatcher = { invalidate: () => undefined } as unknown as WebhookDispatcher
    const service = new WebhookService(repository, dispatcher)
    await expect(service.delete('t1', 'missing')).rejects.toBeInstanceOf(AppError)
  })
})
