import {
  createSessionInputSchema,
  migrateSessionInputSchema,
  qrSchema,
  sessionSchema
} from '@multi-wa/types'
import type { FastifyInstance } from 'fastify'
import QRCode from 'qrcode'
import type { Container } from '../../container'
import { arrayOf, ID_PARAMS, jsonSchema, NO_CONTENT, routeSchema } from '../openapi'
import { streamEvents } from '../sse'
import { parse } from '../validation'

const SESSION = jsonSchema(sessionSchema)

const MIGRATION_RESULT = {
  type: 'object',
  properties: {
    session: SESSION,
    losses: {
      type: 'array',
      items: { type: 'object', additionalProperties: true }
    }
  }
}

export function sessionRoutes(app: FastifyInstance, container: Container): void {
  app.post(
    '/',
    {
      schema: routeSchema({
        tags: ['sessions'],
        summary: 'Create and start a session',
        description: 'Creates a session on the chosen engine and begins pairing.',
        body: createSessionInputSchema,
        secured: true,
        response: { 201: SESSION }
      })
    },
    async (request, reply) => {
      const input = parse(createSessionInputSchema, request.body)
      const session = await container.sessionService.create(request.principal.tenantId, input)
      return reply.status(201).send(session)
    }
  )

  app.get(
    '/',
    {
      schema: routeSchema({
        tags: ['sessions'],
        summary: 'List sessions',
        secured: true,
        response: { 200: arrayOf(sessionSchema) }
      })
    },
    async (request) => container.sessionService.list(request.principal.tenantId)
  )

  app.get(
    '/:id',
    {
      schema: routeSchema({
        tags: ['sessions'],
        summary: 'Get a session',
        params: ID_PARAMS,
        secured: true,
        response: { 200: SESSION }
      })
    },
    async (request) => {
      const { id } = request.params as { id: string }
      return container.sessionService.get(request.principal.tenantId, id)
    }
  )

  app.get(
    '/:id/qr',
    {
      schema: routeSchema({
        tags: ['sessions'],
        summary: 'Get the pairing QR (string + data URL)',
        params: ID_PARAMS,
        secured: true,
        response: { 200: jsonSchema(qrSchema) }
      })
    },
    async (request) => {
      const { id } = request.params as { id: string }
      const qr = await container.sessionService.getQr(request.principal.tenantId, id)
      return { qr, dataUrl: qr ? await QRCode.toDataURL(qr) : null }
    }
  )

  app.get(
    '/:id/events',
    {
      schema: routeSchema({
        tags: ['sessions'],
        summary: 'Stream session events (Server-Sent Events)',
        description: 'Emits qr, status and message events as text/event-stream.',
        params: ID_PARAMS,
        secured: true
      })
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await container.sessionService.connect(request.principal.tenantId, id)
      streamEvents(request, reply, container.manager, id)
    }
  )

  app.post(
    '/:id/connect',
    {
      schema: routeSchema({
        tags: ['sessions'],
        summary: 'Connect a session',
        params: ID_PARAMS,
        secured: true,
        response: { 200: SESSION }
      })
    },
    async (request) => {
      const { id } = request.params as { id: string }
      return container.sessionService.connect(request.principal.tenantId, id)
    }
  )

  app.post(
    '/:id/disconnect',
    {
      schema: routeSchema({
        tags: ['sessions'],
        summary: 'Disconnect a session (keeps credentials)',
        params: ID_PARAMS,
        secured: true,
        response: { 200: SESSION }
      })
    },
    async (request) => {
      const { id } = request.params as { id: string }
      return container.sessionService.disconnect(request.principal.tenantId, id)
    }
  )

  app.post(
    '/:id/logout',
    {
      schema: routeSchema({
        tags: ['sessions'],
        summary: 'Logout a session (wipes credentials)',
        params: ID_PARAMS,
        secured: true,
        response: { 200: SESSION }
      })
    },
    async (request) => {
      const { id } = request.params as { id: string }
      return container.sessionService.logout(request.principal.tenantId, id)
    }
  )

  app.delete(
    '/:id',
    {
      schema: routeSchema({
        tags: ['sessions'],
        summary: 'Delete a session',
        params: ID_PARAMS,
        secured: true,
        response: { 204: NO_CONTENT }
      })
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await container.sessionService.remove(request.principal.tenantId, id)
      return reply.status(204).send()
    }
  )

  app.post(
    '/:id/migrate',
    {
      schema: routeSchema({
        tags: ['sessions'],
        summary: 'Migrate a session to another engine without re-pairing',
        body: migrateSessionInputSchema,
        params: ID_PARAMS,
        secured: true,
        response: { 200: MIGRATION_RESULT }
      })
    },
    async (request) => {
      const { id } = request.params as { id: string }
      const input = parse(migrateSessionInputSchema, request.body)
      return container.sessionService.migrate(request.principal.tenantId, id, input.to)
    }
  )
}
