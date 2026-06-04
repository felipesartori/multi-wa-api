import type { MessageContent } from '@multi-wa/types'
import type { OpenAPIV3 } from 'openapi-types'

export const SECURITY: OpenAPIV3.SecurityRequirementObject[] = [{ apiKey: [] }, { bearer: [] }]

const ERROR_EXAMPLES: Record<number, { code: string; message: string }> = {
  400: { code: 'bad_request', message: 'invalid input' },
  401: { code: 'unauthorized', message: 'authentication required' },
  404: { code: 'not_found', message: 'session not found' },
  409: { code: 'conflict', message: 'session is not connected' },
  429: { code: 'too_many_requests', message: 'rate limit exceeded' },
  500: { code: 'internal_error', message: 'internal server error' }
}

const ERROR_SCHEMA: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: { code: { type: 'string' }, message: { type: 'string' } }
    }
  }
}

function errorResponse(status: number): OpenAPIV3.ResponseObject {
  const example = ERROR_EXAMPLES[status] ?? ERROR_EXAMPLES[500]!
  return {
    description: example.code,
    content: { 'application/json': { schema: ERROR_SCHEMA, example: { error: example } } }
  }
}

const MESSAGE_CONTENT_EXAMPLES: Record<string, MessageContent> = {
  text: { type: 'text', text: 'Olá! 👋' },
  image: { type: 'image', media: { url: 'https://example.com/photo.jpg' }, caption: 'Uma foto' },
  video: { type: 'video', media: { url: 'https://example.com/video.mp4' }, caption: 'Um vídeo' },
  audio: { type: 'audio', media: { url: 'https://example.com/audio.ogg' }, voice: true },
  document: {
    type: 'document',
    media: { url: 'https://example.com/file.pdf' },
    filename: 'file.pdf',
    mimetype: 'application/pdf'
  },
  sticker: { type: 'sticker', media: { base64: 'UklGR...' } },
  location: {
    type: 'location',
    latitude: -23.55052,
    longitude: -46.633308,
    name: 'São Paulo',
    address: 'Av. Paulista, 1000'
  },
  contact: { type: 'contact', fullName: 'João Silva', phone: '+5511999999999' }
}

function messageExamples(): Record<string, OpenAPIV3.ExampleObject> {
  const to = '5511999999999@s.whatsapp.net'
  const examples: Record<string, OpenAPIV3.ExampleObject> = {}
  for (const [type, content] of Object.entries(MESSAGE_CONTENT_EXAMPLES)) {
    examples[type] = { summary: `${type} message`, value: { to, content } }
  }
  return examples
}

const WEBHOOK_DELIVERY_SCHEMA: OpenAPIV3.SchemaObject = {
  oneOf: [
    {
      type: 'object',
      required: ['type', 'qr'],
      properties: { type: { type: 'string', enum: ['qr'] }, qr: { type: 'string' } }
    },
    {
      type: 'object',
      required: ['type', 'status'],
      properties: {
        type: { type: 'string', enum: ['status'] },
        status: {
          type: 'string',
          enum: ['created', 'connecting', 'qr', 'connected', 'disconnected', 'logged_out']
        },
        meJid: { type: 'string' }
      }
    },
    {
      type: 'object',
      required: ['type', 'chat', 'from', 'fromMe'],
      properties: {
        type: { type: 'string', enum: ['message'] },
        id: { type: 'string' },
        chat: { type: 'string' },
        from: { type: 'string' },
        fromMe: { type: 'boolean' },
        text: { type: 'string' },
        timestamp: { type: 'number' }
      }
    }
  ]
}

const WEBHOOK_DELIVERY_EXAMPLES: Record<string, OpenAPIV3.ExampleObject> = {
  qr: { summary: 'qr event', value: { type: 'qr', qr: '2@abc123...' } },
  connected: {
    summary: 'status event (connected)',
    value: { type: 'status', status: 'connected', meJid: '5511999999999@s.whatsapp.net' }
  },
  disconnected: {
    summary: 'status event (disconnected)',
    value: { type: 'status', status: 'disconnected' }
  },
  logged_out: {
    summary: 'status event (logged out)',
    value: { type: 'status', status: 'logged_out' }
  },
  message: {
    summary: 'message event (direct)',
    value: {
      type: 'message',
      id: '3EB0...',
      chat: '5511888888888@s.whatsapp.net',
      from: '5511888888888@s.whatsapp.net',
      fromMe: false,
      text: 'Oi!',
      timestamp: 1730000000
    }
  },
  group_message: {
    summary: 'message event (group)',
    value: {
      type: 'message',
      id: '3EB0...',
      chat: '120363000000000000@g.us',
      from: '5511888888888@s.whatsapp.net',
      fromMe: false,
      text: 'Olá grupo!',
      timestamp: 1730000000
    }
  }
}

const WEBHOOK_DESCRIPTION = [
  'Deliveries are signed with HMAC-SHA256 in the X-Signature header.',
  '',
  'Each delivery is a JSON POST to your `url` with one of these payloads:',
  '- `qr`: new QR code to scan.',
  '- `status`: connection/channel state (`connecting`, `qr`, `connected`, `disconnected`, `logged_out`).',
  '- `message`: inbound/outbound messages. Group messages have `chat` ending in `@g.us` and `from` set to the participant jid.',
  '',
  'See the WebhookDelivery schema for the full payload shapes and examples.'
].join('\n')

function decorateWebhooks(doc: OpenAPIV3.Document): void {
  doc.components ??= {}
  doc.components.schemas ??= {}
  doc.components.schemas.WebhookDelivery = {
    ...WEBHOOK_DELIVERY_SCHEMA,
    example: WEBHOOK_DELIVERY_EXAMPLES.connected!.value
  } as OpenAPIV3.SchemaObject
  const post = doc.paths?.['/webhooks/']?.post as OpenAPIV3.OperationObject | undefined
  if (post) post.description = WEBHOOK_DESCRIPTION
}

export function decorateOpenApi(doc: OpenAPIV3.Document): OpenAPIV3.Document {
  for (const path of Object.values(doc.paths ?? {})) {
    for (const operation of Object.values(path ?? {})) {
      if (!operation || typeof operation !== 'object' || !('responses' in operation)) continue
      const op = operation as OpenAPIV3.OperationObject
      const secured = Array.isArray(op.security) && op.security.length > 0
      const codes = secured ? [400, 401, 404, 409, 429, 500] : [400, 429, 500]
      for (const code of codes) {
        op.responses[code] ??= errorResponse(code)
      }
    }
  }

  const media = doc.paths?.['/sessions/{id}/messages']?.post?.requestBody as
    | OpenAPIV3.RequestBodyObject
    | undefined
  const json = media?.content?.['application/json']
  if (json) json.examples = messageExamples()

  decorateWebhooks(doc)

  return doc
}
