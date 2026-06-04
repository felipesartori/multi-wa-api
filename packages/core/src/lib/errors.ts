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
  notFound: (message = 'Not found') => new AppError(404, 'not_found', message),
  conflict: (message = 'Conflict') => new AppError(409, 'conflict', message)
}
