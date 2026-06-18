import mongoose from 'mongoose'

// Disable Mongoose's internal command buffering globally. Without this, any
// query issued while the connection is down is held in a 10s internal buffer
// and then surfaces as "Operation `users.findOne()` buffering timed out after
// 10000ms" — exactly the production error we are fixing. With buffering off,
// queries fail immediately and the request handler returns a clean error.
mongoose.set('bufferCommands', false)

// Serverless-friendly driver timeouts. Default serverSelectionTimeoutMS is
// 30s, which forces every cold-start failure to wait half a minute before the
// verifyDbConnected middleware can return a clean 503. 5s is enough for Atlas
// SRV resolution + TLS + auth on a healthy cluster, and short enough that an
// unreachable cluster fails fast instead of exhausting the function timeout.
const SERVERLESS_OPTS = {
  bufferCommands: false,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  maxPoolSize: 5,
}

let cachedPromise = null

function resolveMongoUri() {
  return (
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    null
  )
}

function maskUri(uri) {
  try {
    return uri.replace(/:\/\/([^:/@]+):([^@]+)@/, '://$1:****@')
  } catch {
    return '<unparseable uri>'
  }
}

/**
 * connectDB — cached, idempotent, serverless-safe.
 *
 * Lifecycle:
 *   1. If mongoose.connection is already in readyState 1 (connected), return.
 *   2. If a previous attempt failed (readyState != 1 and != 2), drop the
 *      stale cached promise so the next attempt actually retries.
 *   3. If no in-flight promise exists, start mongoose.connect() with the
 *      serverless timeouts.
 *   4. Await the promise. On rejection, clear the cache so the next caller
 *      retries; rethrow so the caller (verifyDbConnected) can map it to 503.
 *
 * This pattern guarantees:
 *   - One connection per warm Lambda/Function instance (no per-request connect).
 *   - Cold starts reuse the in-flight promise across concurrent requests.
 *   - Failed connections are retried on the next request, never stuck.
 */
export async function connectDB() {
  const uri = resolveMongoUri()
  const env = process.env.NODE_ENV || 'development'
  const isVercel = !!process.env.VERCEL

  if (!uri) {
    console.error(
      `[DB] Missing connection URI. Set one of MONGO_URI / MONGODB_URI / DATABASE_URL. ` +
      `env=${env} vercel=${isVercel}`
    )
    throw new Error('MongoDB connection URI is not configured.')
  }

  const READY_CONNECTING = 2
  const READY_CONNECTED = 1

  if (mongoose.connection.readyState === READY_CONNECTED) {
    return mongoose
  }

  // If the cached promise exists but the connection is neither connected nor
  // connecting, the previous attempt failed — reset so we actually retry.
  if (cachedPromise && mongoose.connection.readyState !== READY_CONNECTING) {
    cachedPromise = null
  }

  if (!cachedPromise) {
    console.log(
      `[DB] Connecting — env=${env} vercel=${isVercel} uri=${maskUri(uri)}`
    )
    cachedPromise = mongoose.connect(uri, SERVERLESS_OPTS)
  }

  try {
    await cachedPromise
    return mongoose
  } catch (err) {
    cachedPromise = null
    console.error('[DB] MongoDB connection error:', err.message)
    throw err
  }
}

/**
 * verifyDbConnected — Express middleware.
 *
 * Mounted at /api in server.js, BEFORE all route handlers. Guarantees that
 * every protected request has an open Mongoose connection before any query
 * runs. If the connection cannot be established, the request fails with 503
 * and a generic message — never a raw Mongoose buffering / network error.
 *
 * The /api/health and /api/debug/db routes are intentionally mounted BEFORE
 * this middleware so they remain queryable during a DB outage.
 */
export async function verifyDbConnected(req, res, next) {
  try {
    await connectDB()
    next()
  } catch (err) {
    console.error('[DB Middleware] Connection could not be established:', err.message)
    res.status(503).json({
      success: false,
      error: 'Database connection unavailable. Please try again shortly.',
    })
  }
}

/**
 * getDbStatus — diagnostic snapshot for /api/debug/db.
 * Returns only connection state; never returns the URI or credentials.
 */
export function getDbStatus() {
  const uri = resolveMongoUri()
  const scheme = uri
    ? uri.startsWith('mongodb+srv://')
      ? 'mongodb+srv'
      : uri.startsWith('mongodb://')
        ? 'mongodb'
        : 'other'
    : null

  return {
    connected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    environment: process.env.NODE_ENV || 'development',
    isVercel: !!process.env.VERCEL,
    hasMongoUri: Boolean(uri),
    uriScheme: scheme,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  }
}
