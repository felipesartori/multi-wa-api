import { AppError } from '@multi-wa/core'
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError
} from 'fastify-type-provider-zod'

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  if (error instanceof AppError) {
    void reply
      .status(error.statusCode)
      .send({ error: { code: error.code, message: error.message } })
    return
  }

  if (hasZodFastifySchemaValidationErrors(error)) {
    const message = error.validation.map((issue) => issue.message).join('; ') || 'invalid request'
    void reply.status(400).send({ error: { code: 'bad_request', message } })
    return
  }

  if (isResponseSerializationError(error)) {
    request.log.error({ err: error }, 'response serialization error')
    void reply
      .status(500)
      .send({ error: { code: 'internal_error', message: 'internal server error' } })
    return
  }

  const status = error.statusCode ?? 500
  if (status === 429) {
    void reply
      .status(429)
      .send({ error: { code: 'too_many_requests', message: 'rate limit exceeded' } })
    return
  }
  if (status < 500) {
    void reply.status(status).send({ error: { code: 'bad_request', message: error.message } })
    return
  }

  request.log.error({ err: error }, 'unhandled error')
  void reply
    .status(500)
    .send({ error: { code: 'internal_error', message: 'internal server error' } })
}
