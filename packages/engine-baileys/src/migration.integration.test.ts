import { initAuthCreds } from 'baileys'
import { migrate } from 'wa-store-migrate'
import { describe, expect, it } from 'vitest'

describe('baileys <-> zapo migration via wa-store-migrate', () => {
  it('converts baileys credentials to the zapo shape', () => {
    const creds = initAuthCreds()
    const result = migrate({ from: 'baileys', to: 'zapo', data: { creds, keys: {} } as never })
    const data = result.data as { credentials?: { registrationInfo?: { registrationId?: number } } }
    expect(data.credentials).toBeDefined()
    expect(data.credentials?.registrationInfo?.registrationId).toBe(creds.registrationId)
  })

  it('round-trips through zapo and preserves the identity key', () => {
    const creds = initAuthCreds()
    const toZapo = migrate({ from: 'baileys', to: 'zapo', data: { creds, keys: {} } as never })
    const back = migrate({ from: 'zapo', to: 'baileys', data: toZapo.data as never })
    const restored = back.data as { creds: { signedIdentityKey: { public: Uint8Array } } }
    expect(Buffer.from(restored.creds.signedIdentityKey.public)).toEqual(
      Buffer.from(creds.signedIdentityKey.public)
    )
  })
})
