import { describe, expect, it } from 'vitest'
import { toBaileysContent } from './translate'

describe('toBaileysContent', () => {
  it('maps text', () => {
    expect(toBaileysContent({ type: 'text', text: 'hi' })).toEqual({ text: 'hi' })
  })

  it('maps image by url', () => {
    expect(
      toBaileysContent({ type: 'image', media: { url: 'https://x/y.jpg' }, caption: 'c' })
    ).toEqual({ image: { url: 'https://x/y.jpg' }, caption: 'c' })
  })

  it('maps image by base64 to a buffer', () => {
    const result = toBaileysContent({
      type: 'image',
      media: { base64: Buffer.from('hi').toString('base64') }
    }) as { image: Buffer }
    expect(Buffer.isBuffer(result.image)).toBe(true)
  })

  it('defaults document filename and mimetype', () => {
    const result = toBaileysContent({
      type: 'document',
      media: { url: 'https://x/y' }
    }) as { fileName: string; mimetype: string }
    expect(result.fileName).toBe('file')
    expect(result.mimetype).toBe('application/octet-stream')
  })
})
