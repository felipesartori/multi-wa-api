import type { SendMessageInput, SendMessageResult } from '@multi-wa/types'
import { errors } from '../lib/errors'
import type { SessionManager } from '../sessions/manager'

export class MessagingService {
  constructor(private readonly manager: SessionManager) {}

  async send(sessionId: string, input: SendMessageInput): Promise<SendMessageResult> {
    const engine = this.manager.getEngine(sessionId)
    if (!engine) {
      throw errors.conflict('session is not connected')
    }
    return engine.send(input.to, input.content)
  }
}
