import type { Pool } from '@multi-wa/db'
import type { EngineEvent, Session } from '@multi-wa/types'
import type { EngineOptions, EngineRegistry, WaEngine } from '../engine/types'
import type { Logger } from '../lib/logger'
import type { SessionRepository } from './repository'

export type EngineEventListener = (event: EngineEvent) => void

const MAX_QR_ATTEMPTS = 4

interface ManagedSession {
  engine: WaEngine
  tenantId: string
  lastQr: string | null
  qrCount: number
  listeners: Set<EngineEventListener>
}

export interface SessionManagerDeps {
  pool: Pool
  tablePrefix: string
  logger: Logger
  registry: EngineRegistry
  repository: SessionRepository
  onEvent?: (tenantId: string, sessionId: string, event: EngineEvent) => void
}

export class SessionManager {
  private readonly active = new Map<string, ManagedSession>()

  constructor(private readonly deps: SessionManagerDeps) {}

  isActive(sessionId: string): boolean {
    return this.active.has(sessionId)
  }

  getLastQr(sessionId: string): string | null {
    return this.active.get(sessionId)?.lastQr ?? null
  }

  getEngine(sessionId: string): WaEngine | null {
    return this.active.get(sessionId)?.engine ?? null
  }

  buildOptions(sessionId: string, engine?: string): EngineOptions {
    return {
      sessionId,
      pool: this.deps.pool,
      tablePrefix: this.deps.tablePrefix,
      logger: this.deps.logger.child(
        engine ? { engine, session: sessionId } : { session: sessionId }
      )
    }
  }

  async start(session: Session, tenantId: string): Promise<void> {
    if (this.active.has(session.id)) return
    const factory = this.deps.registry[session.engine]
    const engine = factory(this.buildOptions(session.id, session.engine))
    const managed: ManagedSession = {
      engine,
      tenantId,
      lastQr: null,
      qrCount: 0,
      listeners: new Set()
    }
    this.active.set(session.id, managed)
    engine.onEvent((event) => {
      void this.handleEvent(session.id, managed, event)
    })
    try {
      await engine.start()
    } catch (error) {
      this.active.delete(session.id)
      throw error
    }
  }

  async stop(sessionId: string): Promise<void> {
    const managed = this.active.get(sessionId)
    if (!managed) return
    this.active.delete(sessionId)
    await managed.engine.stop().catch((error) => {
      this.deps.logger.warn({ err: error, session: sessionId }, 'engine stop failed')
    })
  }

  async logout(sessionId: string): Promise<void> {
    const managed = this.active.get(sessionId)
    if (!managed) return
    this.active.delete(sessionId)
    await managed.engine.logout().catch((error) => {
      this.deps.logger.warn({ err: error, session: sessionId }, 'engine logout failed')
    })
  }

  subscribe(sessionId: string, listener: EngineEventListener): () => void {
    const managed = this.active.get(sessionId)
    if (!managed) return () => undefined
    managed.listeners.add(listener)
    return () => {
      managed.listeners.delete(listener)
    }
  }

  private async handleEvent(
    sessionId: string,
    managed: ManagedSession,
    event: EngineEvent
  ): Promise<void> {
    if (event.type === 'qr') {
      managed.qrCount += 1
      if (managed.qrCount > MAX_QR_ATTEMPTS) {
        await this.stopOnQrLimit(sessionId, managed)
        return
      }
      managed.lastQr = event.qr
      await this.deps.repository.updateStatus(sessionId, 'qr').catch(() => undefined)
    } else if (event.type === 'connection') {
      if (event.status === 'connected') {
        managed.lastQr = null
        managed.qrCount = 0
      }
      await this.deps.repository
        .updateStatus(sessionId, event.status, event.meJid ?? null)
        .catch(() => undefined)
    }

    this.notify(sessionId, managed, event)
  }

  private notify(sessionId: string, managed: ManagedSession, event: EngineEvent): void {
    for (const listener of managed.listeners) {
      try {
        listener(event)
      } catch (error) {
        this.deps.logger.warn({ err: error, session: sessionId }, 'event listener failed')
      }
    }

    this.deps.onEvent?.(managed.tenantId, sessionId, event)
  }

  private async stopOnQrLimit(sessionId: string, managed: ManagedSession): Promise<void> {
    this.deps.logger.warn(
      { session: sessionId, attempts: MAX_QR_ATTEMPTS },
      'qr attempt limit reached, stopping session'
    )
    managed.lastQr = null
    await this.stop(sessionId)
    await this.deps.repository.updateStatus(sessionId, 'disconnected').catch(() => undefined)
    this.notify(sessionId, managed, { type: 'connection', status: 'disconnected' })
  }

  async shutdown(): Promise<void> {
    const ids = [...this.active.keys()]
    await Promise.all(
      ids.map((id) =>
        Promise.race([
          this.stop(id),
          new Promise<void>((resolve) => {
            setTimeout(resolve, 3000)
          })
        ])
      )
    )
  }
}
