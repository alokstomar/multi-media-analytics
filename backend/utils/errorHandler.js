export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500
  const message = err.message || 'Internal Server Error'

  console.error(`[Error] ${status} — ${message}`)

  if (err.stack && status === 500) {
    console.error(err.stack)
  }

  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  })
}

export class AppError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}
