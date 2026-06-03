import type { EngineKind } from '@multi-wa/types'
import { pino } from 'pino'
import type { Logger } from '../lib/logger'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EngineOptions, EngineSnapshotAdapter, SnapshotRegistry } from '../engine/types'
import { MigrationService } from './service'

const migrateMock = vi.fn()

vi.mock('wa-store-migrate', () => ({
  migrate: (args: unknown) => migrateMock(args)
}))

const logger = pino({ level: 'silent' }) as unknown as Logger

afterEach(() => {
  migrateMock.mockReset()
})

function adapter(): EngineSnapshotAdapter & {
  written: unknown[]
  cleared: number
} {
  const state = {
    written: [] as unknown[],
    cleared: 0,
    read: async () => ({ credentials: { meJid: 'me' } }),
    write: async (_options: EngineOptions, data: unknown) => {
      state.written.push(data)
    },
    clear: async () => {
      state.cleared += 1
    }
  }
  return state
}

const options: EngineOptions = {
  sessionId: 's1',
  pool: {} as never,
  tablePrefix: 'wa_',
  logger
}

describe('MigrationService', () => {
  it('reads source, converts, writes target and clears source', async () => {
    const from = adapter()
    const to = adapter()
    migrateMock.mockReturnValue({
      data: { credentials: { meJid: 'me' }, converted: true },
      losses: [{ domain: 'sessions', severity: 'warn', count: 2 }]
    })
    const registry = { baileys: from, zapo: to } as unknown as SnapshotRegistry
    const service = new MigrationService(registry, logger)

    const losses = await service.migrate(options, 'baileys' as EngineKind, 'zapo' as EngineKind)

    expect(migrateMock).toHaveBeenCalledWith({
      from: 'baileys',
      to: 'zapo',
      data: { credentials: { meJid: 'me' } }
    })
    expect(to.written).toEqual([{ credentials: { meJid: 'me' }, converted: true }])
    expect(from.cleared).toBe(1)
    expect(losses).toEqual([{ domain: 'sessions', severity: 'warn', count: 2 }])
  })

  it('returns an empty loss list when the migrator reports none', async () => {
    const from = adapter()
    const to = adapter()
    migrateMock.mockReturnValue({ data: {}, losses: undefined })
    const registry = { baileys: from, zapo: to } as unknown as SnapshotRegistry
    const service = new MigrationService(registry, logger)
    const losses = await service.migrate(options, 'zapo' as EngineKind, 'baileys' as EngineKind)
    expect(losses).toEqual([])
  })
})
