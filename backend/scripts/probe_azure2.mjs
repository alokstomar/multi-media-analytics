/**
 * Extended Azure probe — tests multiple endpoint format variations.
 * Usage: node scripts/probe_azure2.mjs
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

const BASE_URL  = env.OPENAI_BASE_URL      // https://enxtaiopenclaw.services.ai.azure.com/openai/v1
const API_KEY   = env.OPENAI_API_KEY
const MODEL     = env.OPENAI_PREMIUM_MODEL  // gpt-5.4

// Derive the resource name from the base URL
const resourceMatch = BASE_URL.match(/https:\/\/([^.]+)\./)
const resourceName = resourceMatch ? resourceMatch[1] : 'unknown'

console.log('\n╔══════════════════════════════════════════════════════════╗')
console.log('║           Azure AI Foundry — Deep Probe v2                ║')
console.log('╚══════════════════════════════════════════════════════════╝')
console.log(`Resource : ${resourceName}`)
console.log(`Base URL : ${BASE_URL}`)
console.log(`Model    : ${MODEL}`)
console.log(`Key len  : ${API_KEY.length}`)

const miniBody = (model) => JSON.stringify({
  model,
  messages: [{ role: 'user', content: 'Reply with JSON: {"ok":true}' }],
  response_format: { type: 'json_object' },
  max_tokens: 10,
})

async function probe(label, url, headers, body) {
  console.log(`\n${'─'.repeat(70)}`)
  console.log(`TEST : ${label}`)
  console.log(`URL  : ${url}`)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    })
    const text = await res.text()
    let parsed
    try { parsed = JSON.parse(text) } catch { parsed = null }
    console.log(`HTTP  : ${res.status} ${res.statusText}`)
    console.log(`Body  : ${text.slice(0, 400)}`)
    return { status: res.status, body: parsed || text }
  } catch (err) {
    console.error(`Error : ${err.message}`)
    return { status: null, error: err.message }
  }
}

// Test 1: Current config with api-key header
await probe(
  'api-key header + /openai/v1 path + gpt-5.4',
  `${BASE_URL}/chat/completions`,
  { 'api-key': API_KEY },
  miniBody(MODEL),
)

// Test 2: Try with api-version query param (legacy Azure OpenAI style)
await probe(
  'api-key header + api-version query param',
  `${BASE_URL}/chat/completions?api-version=2024-12-01-preview`,
  { 'api-key': API_KEY },
  miniBody(MODEL),
)

// Test 3: Try legacy Azure OpenAI endpoint format (different host)
const legacyUrl = `https://${resourceName}.openai.azure.com/openai/deployments/${MODEL}/chat/completions?api-version=2024-12-01-preview`
await probe(
  'Legacy Azure OpenAI endpoint format (.openai.azure.com)',
  legacyUrl,
  { 'api-key': API_KEY },
  // Legacy endpoint doesn't use "model" field in body
  JSON.stringify({
    messages: [{ role: 'user', content: 'Reply with JSON: {"ok":true}' }],
    response_format: { type: 'json_object' },
    max_tokens: 10,
  }),
)

// Test 4: Check if model name is the issue — try gpt-4o
await probe(
  'api-key header + gpt-4o model',
  `${BASE_URL}/chat/completions`,
  { 'api-key': API_KEY },
  miniBody('gpt-4o'),
)

// Test 5: Check if model name is the issue — try gpt-4o-mini
await probe(
  'api-key header + gpt-4o-mini model',
  `${BASE_URL}/chat/completions`,
  { 'api-key': API_KEY },
  miniBody('gpt-4o-mini'),
)

// Test 6: List available deployments (models endpoint)
await probe(
  'GET /models — list available deployments',
  `${BASE_URL}/models`,
  { 'api-key': API_KEY },
  undefined,
)

console.log('\n╔══════════════════════════════════════════════════════════╗')
console.log('║                   END OF PROBE v2                         ║')
console.log('╚══════════════════════════════════════════════════════════╝')
