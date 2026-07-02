// Standalone diagnostic: prints env state, DNS servers, runs c-ares + libuv
// DNS probes, then attempts a real MongoDB connection. Reports each step as
// pass/fail with the underlying cause. Run with: npm run db:check
//
// This script DOES NOT use config/dns.js overrides — it reports what would
// happen WITHOUT the rescue, so the dev can confirm whether DNS_RESOLVERS
// is required on their machine. (Apply overrides via DNS_RESOLVERS env var
// before invoking to test the post-fix state.)

import 'dotenv/config'
import dns from 'node:dns'
import mongoose from 'mongoose'

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
}

function hr(label) {
  console.log(`\n${COLORS.bold}${COLORS.cyan}── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}${COLORS.reset}`)
}

function ok(label) { console.log(`${COLORS.green}  ✓${COLORS.reset} ${label}`) }
function fail(label, detail) { console.log(`${COLORS.red}  ✗${COLORS.reset} ${label}${detail ? `\n     ${COLORS.dim}${detail}${COLORS.reset}` : ''}`) }
function warn(label, detail) { console.log(`${COLORS.yellow}  !${COLORS.reset} ${label}${detail ? `\n     ${COLORS.dim}${detail}${COLORS.reset}` : ''}`) }

function maskUri(uri) {
  try { return uri.replace(/:\/\/([^:/@]+):([^@]+)@/, '://$1:****@') } catch { return '<unparseable>' }
}

// 1. ENVIRONMENT
hr('Environment')
console.log(`  NODE_ENV=${process.env.NODE_ENV || '(unset → defaults to development)'}`)
console.log(`  VERCEL=${process.env.VERCEL || '(unset)'} ${process.env.VERCEL ? '→ production path' : '→ localhost path'}`)
console.log(`  DNS_RESOLVERS=${process.env.DNS_RESOLVERS || '(unset → no override applied; matches production behavior)'}`)

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL
if (!uri) {
  fail('MONGO_URI / MONGODB_URI / DATABASE_URL is not set', 'Add the Atlas connection string to backend/.env')
} else {
  ok(`MONGO_URI is set (${maskUri(uri).slice(0, 80)}...)`)
  ok(`URI scheme: ${uri.startsWith('mongodb+srv://') ? 'mongodb+srv (uses SRV DNS lookup)' : 'mongodb (direct host)'}`)
}

// 2. DNS STATE
hr('System DNS')
const systemServers = dns.getServers()
console.log(`  Configured DNS servers: ${systemServers.join(', ') || '(none)'}`)
if (systemServers.includes('127.0.0.1') || systemServers.includes('::1')) {
  warn('Local loopback (127.0.0.1 / ::1) is in the DNS server list',
    'Often a stopped VPN, ad-blocker, or DoH proxy that didn\'t restore DNS. Set DNS_RESOLVERS=1.1.1.1,8.8.8.8 in backend/.env.')
}

// 3. DNS PROBES (without overrides — simulates "no DNS_RESOLVERS set")
let dnsWorking = true
if (uri && uri.includes('mongodb+srv://')) {
  // Strip credentials: mongodb+srv://user:pass@host/db → host
  const srvHost = uri.replace(/^mongodb\+srv:\/\/[^@]*@/, '').split(/[/?]/)[0]
  if (srvHost) {
    const srvRecord = `_mongodb._tcp.${srvHost}`
    hr(`DNS probe: SRV record ${srvRecord}`)

    await new Promise((resolve) => {
      dns.resolveSrv(srvRecord, (err, addresses) => {
        if (err) {
          fail(`c-ares resolveSrv failed`, `${err.code} ${err.message}`)
          dnsWorking = false
        } else if (addresses.length === 0) {
          fail('SRV record resolved but is empty')
          dnsWorking = false
        } else {
          ok(`SRV resolved — ${addresses.length} host(s):`)
          addresses.slice(0, 3).forEach((a) => console.log(`     ${COLORS.dim}→${COLORS.reset} ${a.name}:${a.port}`))
        }
        resolve()
      })
    })

    hr('DNS probe: libuv getaddrinfo (OS resolver)')
    await new Promise((resolve) => {
      dns.lookup(srvHost, (err, address) => {
        if (err) {
          fail(`getaddrinfo failed`, `${err.code} ${err.message}`)
          dnsWorking = false
        } else {
          ok(`getaddrinfo resolved → ${address}`)
        }
        resolve()
      })
    })
  }
}

// 4. MONGODB CONNECTION TEST
hr('MongoDB connection')
if (!uri) {
  fail('Skipping — no URI configured')
  process.exit(1)
}
if (!dnsWorking) {
  warn('DNS probes failed — connection attempt will likely fail too.',
    'Try setting DNS_RESOLVERS=1.1.1.1,8.8.8.8 in backend/.env and re-run.')
}

const startedAt = Date.now()
try {
  await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 10000,
    maxPoolSize: 1,
  })
  const elapsed = Date.now() - startedAt
  ok(`Connected in ${elapsed}ms`)

  // Ping
  const res = await mongoose.connection.db.admin().ping()
  if (res?.ok === 1) ok('ping() returned { ok: 1 }')
  else warn('ping() returned unexpected payload', JSON.stringify(res))

  await mongoose.disconnect()
  ok('Disconnected cleanly')
} catch (err) {
  const elapsed = Date.now() - startedAt
  fail(`Connection failed after ${elapsed}ms`, `${err.name}: ${err.message}`)
  if (err.cause) console.log(`     ${COLORS.dim}cause:${COLORS.reset} ${err.cause.message}`)
  process.exit(1)
}

hr('Summary')
console.log(`  ${COLORS.green}All checks passed.${COLORS.reset} Backend should be able to reach MongoDB.`)
console.log(`  ${COLORS.dim}If you still see "Database connection unavailable" in the app, run the backend with \`npm run dev\` and check the [DB] logs.${COLORS.reset}`)
process.exit(0)
