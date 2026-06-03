export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const errors = {
  badRequest: (message = 'Bad request') => new AppError(400, 'bad_request', message),
  unauthorized: (message = 'Unauthorized') => new AppError(401, 'unauthorized', message),
  forbidden: (message = 'Forbidden') => new AppError(403, 'forbidden', message),
  notFound: (message = 'Not found') => new AppError(404, 'not_found', message),
  conflict: (message = 'Conflict') => new AppError(409, 'conflict', message),
  unprocessable: (message = 'Unprocessable entity') => new AppError(422, 'unprocessable', message),
  tooManyRequests: (message = 'Too many requests') =>
    new AppError(429, 'too_many_requests', message),
  internal: (message = 'Internal server error') => new AppError(500, 'internal_error', message)
}
