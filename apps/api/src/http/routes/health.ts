import type { FastifyInstance } from 'fastify'
import type { Container } from '../../container'
import { routeSchema } from '../openapi'

const STATUS_RESPONSE = {
  type: 'object',
  properties: { status: { type: 'string' } },
  required: ['status']
}

export function healthRoutes(app: FastifyInstance, container: Container): void {
  app.get(
    '/health',
    {
      schema: routeSchema({
        tags: ['health'],
        summary: 'Liveness probe',
        response: { 200: STATUS_RESPONSE }
      })
    },
    async () => ({ status: 'ok' })
  )

  app.get(
    '/ready',
    {
      schema: routeSchema({
        tags: ['health'],
        summary: 'Readiness probe (checks the database)',
        response: { 200: STATUS_RESPONSE, 503: STATUS_RESPONSE }
      })
    },
    async (_request, reply) => {
      try {
        await container.pool.query('SELECT 1')
        return { status: 'ready' }
      } catch {
        return reply.status(503).send({ status: 'unavailable' })
      }
    }
  )
}
