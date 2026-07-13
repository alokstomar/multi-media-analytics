/**
 * Azure key format inspector + endpoint detection probe.
 * Azure AI Foundry keys issued from the portal look like:
 *   xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxACOGlFwr
 * The last segment after 'AAAB' is a resource fingerprint.
 *
 * This probe tries to find the correct endpoint by:
 *   1. Checking what Azure resource name the key actually belongs to
 *   2. Testing variations of the endpoint
 *   3. Testing the Azure AI Inference SDK endpoint format
 *
 * Usage: node scripts/probe_azure3.mjs
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')
const env = {}
readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  const eq = trimmed.indexOf('=')
  if (eq < 0) return
  env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
})

const API_KEY = env.OPENAI_API_KEY
const MODEL   = env.OPENAI_PREMIUM_MODEL

console.log('\n╔══════════════════════════════════════════════════════════╗')
console.log('║         Azure Key Format + Endpoint Detection Probe       ║')
console.log('╚══════════════════════════════════════════════════════════╝')
console.log(`Key length : ${API_KEY.length}`)
console.log(`Full key   : ${API_KEY}`)
console.log()

// Azure AI Foundry keys issued through the portal have a specific structure:
// They are base64-encoded and contain the resource name/region info.
// The typical structure for Azure AI Services subscription keys is a 32-char hex UUID
// but newer Foundry keys issued via "API Access" look like base64 blobs ending in ==

// Check key structure
const isHexKey = /^[0-9a-f]{32}$/i.test(API_KEY)
const isBase64Like = /^[A-Za-z0-9+/=]+$/.test(API_KEY) && API_KEY.length > 40
console.log('Key type analysis:')
console.log(`  isHexKey (classic Azure OpenAI): ${isHexKey}`)
console.log(`  isBase64Like (Azure AI Foundry Entra-style): ${isBase64Like}`)
console.log()

// The key is 84 chars and contains uppercase+lowercase+digits — this is the
// Azure AI Foundry "API key" format, which actually encodes subscription + resource info.
// It must be sent as "api-key" header, not "Authorization: Bearer".
// But the resource endpoint also needs to match exactly.

// Extract potential resource name from key structure (keys from Azure AI Foundry portal
// contain the resource identifier near the end after base64 decoding)
try {
  const decoded = Buffer.from(API_KEY, 'base64').toString('utf8')
  console.log('Base64-decoded key (first 100 chars):', decoded.slice(0, 100).replace(/[^\x20-\x7e]/g, '.'))
  console.log()
} catch (e) {
  console.log('Key is not valid base64')
}

async function probe(label, url, headers, method = 'GET', body = undefined) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } }
    if (body) opts.body = body
    const res = await fetch(url, opts)
    const text = await res.text()
    console.log(`[${res.status}] ${label}`)
    if (res.status !== 200) {
      const short = text.slice(0, 200).replace(/\n/g, ' ')
      console.log(`       → ${short}`)
    } else {
      console.log(`       → SUCCESS: ${text.slice(0, 300)}`)
    }
    return res.status
  } catch (err) {
    console.log(`[ERR] ${label} → ${err.message}`)
    return null
  }
}

const miniBody = JSON.stringify({
  model: MODEL,
  messages: [{ role: 'user', content: 'Reply: {"ok":true}' }],
  response_format: { type: 'json_object' },
  max_tokens: 10,
})

// ── Strategy: the key might belong to a different resource name ──────────
// Common Azure AI Foundry resource naming for the key: enxtaiopenclaw might
// be wrong, or the region might be wrong.

// From the key: "COGlFwr" — COG often = Cognitive Services.
// Try the cognitiveservices.azure.com endpoint which is the classic AOAI path.

console.log('\n── Trying alternative endpoint patterns ─────────────────────\n')

// The /openai/v1 path is the new "Azure AI Foundry" unified endpoint.
// If the resource was provisioned as a standard "Azure OpenAI" resource (not AI Foundry),
// it uses: https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version=...

// Maybe the .env has the right resource name but wrong path pattern.
// Test: GET the root to see what Azure returns
await probe('Root GET', 'https://enxtaiopenclaw.services.ai.azure.com/', { 'api-key': API_KEY })
await probe('Root GET (openai subdomain)', 'https://enxtaiopenclaw.openai.azure.com/', { 'api-key': API_KEY })

// Test: maybe the resource doesn't exist at all (DNS check)
try {
  const r = await fetch('https://enxtaiopenclaw.services.ai.azure.com/health', { method: 'GET' })
  console.log(`[DNS/Health] enxtaiopenclaw.services.ai.azure.com/health → ${r.status}`)
} catch (e) {
  console.log(`[DNS/Health] enxtaiopenclaw.services.ai.azure.com → ERROR: ${e.message}`)
}

try {
  const r = await fetch('https://enxtaiopenclaw.openai.azure.com/openai/models?api-version=2024-12-01-preview', {
    headers: { 'api-key': API_KEY }
  })
  const t = await r.text()
  console.log(`[${r.status}] Legacy openai.azure.com /models → ${t.slice(0, 300)}`)
} catch (e) {
  console.log(`[ERR] Legacy openai.azure.com /models → ${e.message}`)
}

// The key starts with "2LHExDruBf7sFCiKn0A7wohkZSxQhlh9h4VuuKqB1yK18uwtZuXXJQQJ99CD"
// followed by "ACYeBjFXJ3w3AAABACOGlFwr"
// Breaking it down: "AAAB" is a common Azure key separator, "ACOG" = resource type hint
// "lFwr" = resource identifier suffix

// The AZURE_OPENAI vars in the .env diagnostic show as 'not configured' separately.
// Check if there's a AZURE_OPENAI_ENDPOINT env var set (it's logged in provider startup)
console.log('\n── Additional env var check ─────────────────────────────────')
console.log('AZURE_OPENAI_API_KEY    :', env.AZURE_OPENAI_API_KEY ? `set (len=${env.AZURE_OPENAI_API_KEY.length})` : 'not set')
console.log('AZURE_OPENAI_ENDPOINT   :', env.AZURE_OPENAI_ENDPOINT || 'not set')
console.log('AZURE_OPENAI_DEPLOYMENT :', env.AZURE_OPENAI_DEPLOYMENT || 'not set')
console.log('OPENAI_BASE_URL         :', env.OPENAI_BASE_URL)
console.log('OPENAI_FAST_MODEL       :', env.OPENAI_FAST_MODEL)
console.log('OPENAI_PREMIUM_MODEL    :', env.OPENAI_PREMIUM_MODEL)

console.log('\n── Conclusion ───────────────────────────────────────────────')
console.log('If ALL above endpoints return 401, the API key is invalid or')
console.log('belongs to a different Azure resource than "enxtaiopenclaw".')
console.log('Next step: Go to Azure AI Foundry portal and:')
console.log('  1. Find your actual resource name')
console.log('  2. Copy the correct API key from Keys and Endpoints')
console.log('  3. Verify the deployment name (gpt-5.4)')
