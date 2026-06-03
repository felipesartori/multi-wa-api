import type { MessageContent } from '@multi-wa/types'
import { describe, expect, it } from 'vitest'
import { AppError } from '../lib/errors'
import type { SessionManager } from '../sessions/manager'
import { MessagingService } from './service'

describe('MessagingService', () => {
  it('routes the content to the active engine', async () => {
    let captured: { to: string; content: MessageContent } | undefined
    const manager = {
      getEngine: () => ({
        send: async (to: string, content: MessageContent) => {
          captured = { to, content }
          return { id: 'sent-1' }
        }
      })
    } as unknown as SessionManager
    const service = new MessagingService(manager)

    const result = await service.send('s1', {
      to: '5511999999999',
      content: { kind: 'text', text: 'hi' }
    })

    expect(result).toEqual({ id: 'sent-1' })
    expect(captured).toEqual({
      to: '5511999999999',
      content: { kind: 'text', text: 'hi' }
    })
  })

  it('throws conflict when the session is not connected', async () => {
    const manager = { getEngine: () => null } as unknown as SessionManager
    const service = new MessagingService(manager)
    await expect(
      service.send('s1', { to: 'x', content: { kind: 'text', text: 'hi' } })
    ).rejects.toBeInstanceOf(AppError)
  })
})
