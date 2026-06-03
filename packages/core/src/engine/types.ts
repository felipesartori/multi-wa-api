import type { Pool } from '@multi-wa/db'
import type { EngineEvent, EngineKind, MessageContent, SendMessageResult } from '@multi-wa/types'
import type { Logger } from '../lib/logger'

export interface EngineOptions {
  sessionId: string
  pool: Pool
  tablePrefix: string
  logger: Logger
}

export interface WaEngine {
  readonly kind: EngineKind
  start(): Promise<void>
  stop(): Promise<void>
  logout(): Promise<void>
  send(to: string, content: MessageContent): Promise<SendMessageResult>
  onEvent(handler: (event: EngineEvent) => void): void
}

export type EngineFactory = (options: EngineOptions) => WaEngine
export type EngineRegistry = Record<EngineKind, EngineFactory>

export interface EngineSnapshotAdapter {
  read(options: EngineOptions): Promise<unknown>
  write(options: EngineOptions, data: unknown): Promise<void>
  clear(options: EngineOptions): Promise<void>
}

export type SnapshotRegistry = Record<EngineKind, EngineSnapshotAdapter>
