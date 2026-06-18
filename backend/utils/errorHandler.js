/**
 * Central error handler.
 *
 * Two responsibilities:
 *   1. Map known error classes to clean HTTP responses (409 for duplicates,
 *      503 for connection issues, 400 for AppError / validation).
 *   2. Ensure raw Mongoose / MongoDB errors and stack traces never reach the
 *      client. The production user must see generic messages like
 *      "Database connection unavailable" — never
 *      "users.findOne() buffering timed out after 10000ms".
 *
 * Internal logs still get the full error for debugging.
 */

// MongoDB / Mongoose error class names we treat as connection-related.
// Source: mongodb driver 6.x and mongoose 8.x error hierarchies.
const DB_ERROR_NAMES = new Set([
  'MongooseError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoServerSelectionError',
  'MongoParseError',
  'MongoExpiredSessionError',
])

function isDuplicateKey(err) {
  return (
    err?.code === 11000 ||
    err?.code === 11001 ||
    /E11000|duplicate key/i.test(err?.message || '')
  )
}

function isBufferingTimeout(err) {
  const msg = (err?.message || '').toLowerCase()
  return (
    err?.name === 'MongooseError' &&
    (msg.includes('buffering timed out') || msg.includes('buffer'))
  )
}

function isDbError(err) {
  if (!err) return false
  if (DB_ERROR_NAMES.has(err.name)) return true
  const msg = (err.message || '').toLowerCase()
  return (
    msg.includes('buffering timed out') ||
    msg.includes('server selection timed out') ||
    msg.includes('topology was destroyed') ||
    msg.includes('connection ') && msg.includes('closed')
  )
}

export function errorHandler(err, _req, res, _next) {
  let status = err?.status || 500
  let message = err?.message || 'Internal Server Error'
  let exposed = message

  // 1. AppError (intentional, operational) — trust the message as-is.
  if (err?.name === 'AppError' || err instanceof AppError) {
    status = err.status || 400
    exposed = err.message
  }
  // 2. Duplicate key — 409 Conflict, with a friendly per-collection message.
  else if (isDuplicateKey(err)) {
    status = 409
    const coll = err?.collection || (err?.message?.match(/collection:\s+\S+\.(\w+)/) || [])[1]
    if (coll === 'channels' || /channels/i.test(err.message)) {
      exposed = 'Channel already connected.'
    } else if (coll === 'users' || /users\.email|email/i.test(err.message)) {
      exposed = 'An account with this email already exists.'
    } else {
      exposed = 'A record with this identifier already exists.'
    }
  }
  // 3. Buffering timeout — the exact production failure. Map to 503.
  else if (isBufferingTimeout(err)) {
    status = 503
    exposed = 'Database connection unavailable. Please try again shortly.'
  }
  // 4. Other DB-layer errors (network, server selection, parse, closed).
  else if (isDbError(err)) {
    status = 503
    exposed = 'Database connection unavailable. Please try again shortly.'
  }
  // 5. Fallback — never leak raw internals on a 5xx.
  else if (status >= 500) {
    exposed = 'Internal server error. Please try again later.'
  }

  // Internal log keeps the full error for debugging.
  console.error(`[Error] ${status} — ${message}`)
  if (err?.stack && status >= 500) {
    console.error(err.stack)
  }

  const body = { success: false, error: exposed }
  if (process.env.NODE_ENV !== 'production' && err?.stack) {
    body.stack = err.stack
  }

  res.status(status).json(body)
}

export class AppError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'AppError'
    this.status = status
  }
}
