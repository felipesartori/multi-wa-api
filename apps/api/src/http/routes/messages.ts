import { sendMessageInputSchema, sendMessageResultSchema } from '@multi-wa/types'
import type { FastifyInstance } from 'fastify'
import type { Container } from '../../container'
import { ID_PARAMS, jsonSchema, routeSchema, sendMessageBodyJson } from '../openapi'
import { parse } from '../validation'

export function messageRoutes(app: FastifyInstance, container: Container): void {
  app.post(
    '/:id/messages',
    {
      schema: routeSchema({
        tags: ['messages'],
        summary: 'Send a normalized message',
        description:
          'Engine-agnostic content. content.type is one of text, image, video, audio, document, sticker, location, contact.',
        bodyJson: sendMessageBodyJson(),
        params: ID_PARAMS,
        secured: true,
        response: { 200: jsonSchema(sendMessageResultSchema) }
      })
    },
    async (request) => {
      const { id } = request.params as { id: string }
      await container.sessionService.get(request.principal.tenantId, id)
      const input = parse(sendMessageInputSchema, request.body)
      return container.messagingService.send(id, input)
    }
  )
}
