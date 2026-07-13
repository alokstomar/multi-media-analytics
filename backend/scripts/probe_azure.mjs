/**
 * Azure AI Foundry endpoint probe — run once to confirm the root cause.
 * Usage:  node scripts/probe_azure.mjs
 *
 * This script makes TWO minimal raw HTTP requests to the configured Azure
 * AI Foundry endpoint:
 *   1. With  Authorization: Bearer <key>  — what the OpenAI SDK sends today
 *   2. With  api-key: <key>               — what Azure actually requires
 *
 * It then prints the HTTP status + response body for each attempt so we can
 * confirm exactly which auth header is rejected and which succeeds.
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// ── Load .env manually (no dotenv dependency needed) ─────────────────────
const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')
const env = {}
readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  const eq = trimmed.indexOf('=')
  if (eq < 0) return
  env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
})

const BASE_URL   = env.OPENAI_BASE_URL      // e.g. https://…services.ai.azure.com/openai/v1
const API_KEY    = env.OPENAI_API_KEY
const MODEL      = env.OPENAI_PREMIUM_MODEL  // gpt-5.4

if (!BASE_URL || !API_KEY || !MODEL) {
  console.error('Missing OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_PREMIUM_MODEL in .env')
  process.exit(1)
}

const url = `${BASE_URL}/chat/completions`
const body = JSON.stringify({
  model: MODEL,
  messages: [{ role: 'user', content: 'Say "OK" in JSON: {"status":"OK"}' }],
  response_format: { type: 'json_object' },
  max_tokens: 20,
})

async function probe(label, headers) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`TEST: ${label}`)
  console.log(`URL : ${url}`)
  console.log(`Model: ${MODEL}`)
  console.log(`Headers sent:`, Object.keys(headers).join(', '))
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body })
    const text = await res.text()
    console.log(`HTTP Status : ${res.status} ${res.statusText}`)
    console.log(`x-request-id: ${res.headers.get('x-request-id') || '(none)'}`)
    console.log(`ms-request-id: ${res.headers.get('x-ms-request-id') || '(none)'}`)
    try {
      const parsed = JSON.parse(text)
      console.log('Response body:', JSON.stringify(parsed, null, 2).slice(0, 600))
    } catch {
      console.log('Response body (raw):', text.slice(0, 600))
    }
    return res.status
  } catch (err) {
    console.error(`Network error:`, err.message)
    return null
  }
}

console.log('\n╔══════════════════════════════════════════════════════════╗')
console.log('║          Azure AI Foundry — Authentication Probe          ║')
console.log('╚══════════════════════════════════════════════════════════╝')
console.log(`Endpoint : ${BASE_URL}`)
console.log(`Model    : ${MODEL}`)
console.log(`Key len  : ${API_KEY.length} chars`)
console.log(`Key head : ${API_KEY.slice(0, 6)}… (first 6 chars, safe to log)`)

const s1 = await probe('Authorization: Bearer <key>  (current SDK behaviour)', {
  'Authorization': `Bearer ${API_KEY}`,
})

const s2 = await probe('api-key: <key>  (Azure AI Foundry required header)', {
  'api-key': API_KEY,
})

console.log('\n╔══════════════════════════════════════════════════════════╗')
console.log('║                        VERDICT                            ║')
console.log('╚══════════════════════════════════════════════════════════╝')
console.log(`Authorization: Bearer → HTTP ${s1}  ${s1 === 401 ? '❌  REJECTED' : s1 === 200 ? '✅  accepted' : '⚠️  unexpected'}`)
console.log(`api-key: <key>        → HTTP ${s2}  ${s2 === 200 ? '✅  ACCEPTED (fix works!)' : s2 === 401 ? '❌  also rejected' : '⚠️  unexpected'}`)
console.log()
if (s2 === 401) {
  console.log('Both headers rejected → The API KEY ITSELF is invalid/rotated.')
  console.log('Action: Go to Azure AI Foundry portal → Keys and Endpoints → copy Key 1')
  console.log('Then update backend/.env OPENAI_API_KEY and Vercel env var.')
} else if (s1 === 401 && s2 === 200) {
  console.log('Only Bearer rejected → Header type was the issue (now fixed in openaiProvider.js).')
  console.log('The openaiProvider.js defaultHeaders fix resolves this.')
} else if (s2 === 200) {
  console.log('api-key header works! The openaiProvider.js patch is sufficient.')
}
