import dns from 'node:dns'

// ─────────────────────────────────────────────────────────────────────────
// Localhost DNS rescue + production-safe defaults.
//
// Why this exists:
//   Node's MongoDB driver resolves `mongodb+srv://` URIs by issuing SRV
//   record lookups via the c-ares library, NOT the OS resolver. When the
//   OS DNS is set to 127.0.0.1 (a stopped VPN / DoH proxy / ad-blocker
//   that didn't restore DNS on exit), c-ares sends UDP queries to
//   127.0.0.1:53 — nothing answers, every lookup fails with
//   `ECONNREFUSED querySrv ...`. Meanwhile `nslookup` (which uses the
//   Windows system resolver) succeeds, masking the issue.
//
// What this module does:
//   1. If DNS_RESOLVERS env var is set (comma-separated IPv4), applies
//      dns.setServers([...]) so c-ares uses those resolvers instead of
//      the broken 127.0.0.1.
//   2. Calls dns.setDefaultResultOrder('ipv4first') so getaddrinfo
//      (libuv) prefers IPv4 — works around environments where the IPv6
//      link-local resolver is the only one configured.
//
// Production safety:
//   - DNS_RESOLVERS is OPT-IN. If unset (the case on Vercel), nothing
//     changes — production continues to use the platform-configured DNS.
//   - This module is imported before config/db.js in server.js, so the
//     overrides are in effect before the first MongoDB connection.
//   - All actions are logged with a [DNS] prefix so the cause is visible.
// ─────────────────────────────────────────────────────────────────────────

let appliedServers = null
let appliedResultOrder = null
let systemServersAtBoot = []

function parseResolvers(raw) {
  if (!raw || typeof raw !== 'string') return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function captureSystemSnapshot() {
  try {
    systemServersAtBoot = dns.getServers()
  } catch {
    systemServersAtBoot = []
  }
}

export function applyDnsOverrides() {
  captureSystemSnapshot()

  const wanted = parseResolvers(process.env.DNS_RESOLVERS)
  if (wanted.length > 0) {
    try {
      dns.setServers(wanted)
      appliedServers = wanted
      console.log(`[DNS] Applied DNS_RESOLVERS: ${wanted.join(', ')}`)
      console.log(`[DNS] (was: ${systemServersAtBoot.join(', ') || '(none)'})`)
    } catch (err) {
      console.error(`[DNS] Failed to apply DNS_RESOLVERS (${wanted.join(', ')}):`, err.message)
    }
  }

  // ipv4first is harmless on Linux/Vercel and helps Windows+IPv6 cases.
  // Only opt out if DNS_RESULT_ORDER is explicitly set to something else.
  if (!process.env.DNS_RESULT_ORDER) {
    try {
      dns.setDefaultResultOrder('ipv4first')
      appliedResultOrder = 'ipv4first'
    } catch {
      // Older Node versions may not support setDefaultResultOrder — non-fatal.
    }
  } else if (process.env.DNS_RESULT_ORDER !== 'system-default') {
    try {
      dns.setDefaultResultOrder(process.env.DNS_RESULT_ORDER)
      appliedResultOrder = process.env.DNS_RESULT_ORDER
    } catch {
      // Invalid order string — ignore.
    }
  }
}

export function getDnsStatus() {
  let currentServers = []
  try {
    currentServers = dns.getServers()
  } catch {
    currentServers = []
  }
  return {
    systemServersAtBoot,
    currentServers,
    appliedResolvers: appliedServers,
    appliedResultOrder,
    configuredViaEnv: Boolean(process.env.DNS_RESOLVERS),
    isVercel: Boolean(process.env.VERCEL),
  }
}

// Apply eagerly on first import so the overrides are active before any
// downstream module (e.g. mongoose) attempts DNS resolution.
applyDnsOverrides()
