import { z } from 'zod/v4'
import type { Container } from '../../container'
import type { AppInstance } from '../types'

const statusSchema = z.object({ status: z.string() })

export function healthRoutes(app: AppInstance, container: Container): void {
  app.get(
    '/health',
    { schema: { tags: ['health'], summary: 'Liveness probe', response: { 200: statusSchema } } },
    async () => ({ status: 'ok' })
  )

  app.get(
    '/ready',
    {
      schema: {
        tags: ['health'],
        summary: 'Readiness probe (checks the database)',
        response: { 200: statusSchema, 503: statusSchema }
      }
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
