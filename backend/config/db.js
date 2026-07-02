import mongoose from 'mongoose'
import dns from 'node:dns'

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

// Diagnostic state — captures the most recent connection outcome so
// /api/debug/db can report WHY the connection failed, not just THAT it failed.
// Without this, readyState=0 + no visible error in Vercel logs is a dead end.
let lastConnectError = null
let lastConnectAt = null
let connectAttempts = 0

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

// Classify a MongoDB connection error so logs can call out the failure mode
// (DNS / auth / network / server-selection) instead of leaving the dev to
// decode a raw `querySrv ECONNREFUSED` string.
function classifyDbError(err) {
  const msg = (err?.message || '').toLowerCase()
  if (err?.code === 'ENOTFOUND' || /querysrv|querya|queryaaaa|edns|dns/.test(msg)) {
    return 'dns'
  }
  if (err?.code === 'ECONNREFUSED' && /querysrv|querya|_mongodb\._tcp/.test(msg)) {
    return 'dns'
  }
  if (err?.code === 'ECONNREFUSED') {
    return 'network'
  }
  if (err?.name === 'MongoServerSelectionError') {
    return /timeout|timed out/i.test(msg) ? 'timeout' : 'server-selection'
  }
  if (err?.name === 'MongoNetworkError' || err?.name === 'MongoNetworkTimeoutError') {
    return 'network'
  }
  if (err?.name === 'MongoParseError') {
    return 'uri-format'
  }
  if (/authentication failed|bad auth|invalid credential/i.test(msg)) {
    return 'auth'
  }
  return 'unknown'
}

function logActionableDbError(err, category) {
  const isVercel = !!process.env.VERCEL
  const hintByCategory = {
    dns: isVercel
      ? 'Atlas SRV DNS lookup failed on the platform DNS. Check Atlas status / Network Access list.'
      : 'Local DNS resolution failed. Set DNS_RESOLVERS=1.1.1.1,8.8.8.8 in backend/.env — see config/dns.js.',
    network: 'Could not reach MongoDB host. Check internet connection, VPN, firewall, or Atlas Network Access IP whitelist.',
    timeout: 'Connected but server selection timed out. Check Atlas cluster load or increase serverSelectionTimeoutMS.',
    'server-selection': 'Driver could not pick a server. Cluster may be paused, scaled to zero, or whitelist is blocking this IP.',
    'uri-format': 'MONGO_URI is malformed. Check scheme (mongodb+srv://), host, db name, and query params.',
    auth: 'Authentication failed — verify the database user credentials and password in MONGO_URI.',
    unknown: 'Unspecified MongoDB driver error.',
  }
  const hint = hintByCategory[category] || hintByCategory.unknown
  console.error(`[DB] Connection error — category=${category}`)
  console.error(`[DB] Underlying message: ${err?.message || '(no message)'}`)
  console.error(`[DB] Driver metadata:`, {
    name: err?.name,
    code: err?.code,
    codeName: err?.codeName,
  })
  console.error(`[DB] Hint: ${hint}`)
  try {
    const servers = dns.getServers()
    console.error(`[DB] Active DNS servers at failure: ${servers.join(', ')}`)
  } catch { /* non-blocking */ }
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
export async function connectDB({ force = false } = {}) {
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

  if (mongoose.connection.readyState === READY_CONNECTED && !force) {
    return mongoose
  }

  // If the cached promise exists but the connection is neither connected nor
  // connecting, the previous attempt failed — reset so we actually retry.
  // force=true also resets so /api/debug/db?reconnect=1 can drive a fresh attempt.
  if (force || (cachedPromise && mongoose.connection.readyState !== READY_CONNECTING)) {
    cachedPromise = null
  }

  if (!cachedPromise) {
    connectAttempts += 1
    console.log(
      `[DB] Connecting — env=${env} vercel=${isVercel} uri=${maskUri(uri)}`
    )
    cachedPromise = mongoose.connect(uri, SERVERLESS_OPTS)
  }

  try {
    await cachedPromise
    lastConnectError = null
    return mongoose
  } catch (err) {
    cachedPromise = null
    lastConnectAt = new Date().toISOString()
    const category = classifyDbError(err)
    // Capture the structured error — name + code + category tell us the
    // failure class. Stash before rethrow so /api/debug/db can report it.
    lastConnectError = {
      message: err.message,
      name: err.name,
      code: err.code ?? null,
      codeName: err.codeName ?? null,
      category,
    }
    logActionableDbError(err, category)
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
    uriLength: uri ? uri.length : 0,
    // Masked preview catches structural issues (trailing whitespace, missing
    // db name, missing ?retryWrites, malformed host) without leaking password.
    uriMaskedPreview: uri ? maskUri(uri) : null,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
    lastConnectError,
    lastConnectAt,
    connectAttempts,
    cachedPromisePending: Boolean(cachedPromise),
  }
}
