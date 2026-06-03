import { createWebhookInputSchema, webhookCreatedSchema, webhookSchema } from '@multi-wa/types'
import type { FastifyInstance } from 'fastify'
import type { Container } from '../../container'
import { arrayOf, ID_PARAMS, jsonSchema, NO_CONTENT, routeSchema } from '../openapi'
import { parse } from '../validation'

export function webhookRoutes(app: FastifyInstance, container: Container): void {
  app.post(
    '/',
    {
      schema: routeSchema({
        tags: ['webhooks'],
        summary: 'Register a webhook',
        description: 'Deliveries are signed with HMAC-SHA256 in the X-Signature header.',
        body: createWebhookInputSchema,
        secured: true,
        response: { 201: jsonSchema(webhookCreatedSchema) }
      })
    },
    async (request, reply) => {
      const input = parse(createWebhookInputSchema, request.body)
      const webhook = await container.webhookService.create(request.principal.tenantId, input)
      return reply.status(201).send(webhook)
    }
  )

  app.get(
    '/',
    {
      schema: routeSchema({
        tags: ['webhooks'],
        summary: 'List webhooks',
        secured: true,
        response: { 200: arrayOf(webhookSchema) }
      })
    },
    async (request) => container.webhookService.list(request.principal.tenantId)
  )

  app.delete(
    '/:id',
    {
      schema: routeSchema({
        tags: ['webhooks'],
        summary: 'Delete a webhook',
        params: ID_PARAMS,
        secured: true,
        response: { 204: NO_CONTENT }
      })
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await container.webhookService.delete(request.principal.tenantId, id)
      return reply.status(204).send()
    }
  )
}
