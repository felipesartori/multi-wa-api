import { afterEach, describe, expect, it, vi } from 'vitest'
import { toZapoContent } from './translate'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('toZapoContent', () => {
  it('maps text', async () => {
    expect(await toZapoContent({ kind: 'text', text: 'hi' })).toEqual({ type: 'text', text: 'hi' })
  })

  it('maps image by base64 to bytes with mimetype', async () => {
    const result = (await toZapoContent({
      kind: 'image',
      media: { base64: Buffer.from('hi').toString('base64') },
      caption: 'c'
    })) as { type: string; media: Uint8Array; mimetype: string }
    expect(result.type).toBe('image')
    expect(result.mimetype).toBe('image/jpeg')
    expect(result.media).toBeInstanceOf(Uint8Array)
  })

  it('fetches media by url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode('bytes').buffer
      }))
    )
    const result = (await toZapoContent({
      kind: 'document',
      media: { url: 'https://x/y.pdf' },
      filename: 'y.pdf'
    })) as { type: string; media: Uint8Array; fileName?: string }
    expect(result.type).toBe('document')
    expect(result.media).toBeInstanceOf(Uint8Array)
    expect(result.fileName).toBe('y.pdf')
  })

  it('maps location to a proto message', async () => {
    const result = (await toZapoContent({ kind: 'location', latitude: 1, longitude: 2 })) as {
      locationMessage: { degreesLatitude: number; degreesLongitude: number }
    }
    expect(result.locationMessage.degreesLatitude).toBe(1)
    expect(result.locationMessage.degreesLongitude).toBe(2)
  })
})
