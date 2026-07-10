import { SearchProviderInterface } from './searchProviderInterface.js'

// Tavily Search Provider — grounded live-web verification for the Research
// Workspace. Implements the same SearchProviderInterface as the stub so the
// research engine doesn't change when this provider is active.
//
// Auth: Bearer header (preferred over api_key-in-body so the key stays out
// of request logs).
//
// Cost posture: basic search_depth, max 5 results per query, in-memory
// cache with 24h TTL so identical claim texts (across runs or within a run)
// don't re-hit Tavily.
//
// Failure handling: per-query try/catch returns [] on error. Tracks
// consecutive failures; after DEGRADED_THRESHOLD in a row, isDegraded()
// flips true so the engine can fall back to AI-only analysis for this run.

const TAVILY_ENDPOINT = 'https://api.tavily.com/search'
const DEFAULT_MAX_RESULTS = 5
const DEFAULT_SEARCH_DEPTH = 'basic' // 'basic' | 'advanced'
const DEFAULT_TOPIC = 'general' // 'general' | 'news'
const REQUEST_TIMEOUT_MS = 15000
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const DEGRADED_THRESHOLD = 3

const cache = new Map() // key: normalized query → { results, expiresAt }

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// Normalize Tavily's response shape into the provider-agnostic shape the
// research engine expects. Never expose Tavily-specific field names upstream.
function normalizeResults(raw) {
  if (!raw || typeof raw !== 'object') return []
  const list = Array.isArray(raw.results) ? raw.results : []
  return list
    .filter((r) => r && typeof r.url === 'string')
    .slice(0, DEFAULT_MAX_RESULTS)
    .map((r) => ({
      url: r.url,
      title: r.title || '',
      snippet: r.content || '',
      publishedDate: r.published_date || r.publishedDate || '',
      domain: extractDomain(r.url),
      score: typeof r.score === 'number' ? r.score : null,
    }))
}

export class TavilySearchProvider extends SearchProviderInterface {
  constructor(apiKey) {
    super()
    if (!apiKey) throw new Error('TavilySearchProvider requires an API key')
    this.apiKey = apiKey
    this.consecutiveFailures = 0
    this.lastError = null
  }

  get label() { return 'tavily' }
  get grounded() { return true }

  // True after DEGRADED_THRESHOLD consecutive failures. The engine reads
  // this to decide whether to mark the run as fallback-to-AI-only.
  isDegraded() {
    return this.consecutiveFailures >= DEGRADED_THRESHOLD
  }

  async searchWeb(query, opts = {}) {
    if (!query || typeof query !== 'string') return []

    const cacheKey = query.trim().toLowerCase()
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.results
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch(TAVILY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          search_depth: opts.searchDepth || DEFAULT_SEARCH_DEPTH,
          max_results: opts.maxResults || DEFAULT_MAX_RESULTS,
          topic: opts.topic || DEFAULT_TOPIC,
          include_answer: false,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Tavily HTTP ${res.status}: ${body.slice(0, 200)}`)
      }

      const json = await res.json()
      const results = normalizeResults(json)

      cache.set(cacheKey, { results, expiresAt: Date.now() + CACHE_TTL_MS })
      this.consecutiveFailures = 0
      this.lastError = null
      return results
    } catch (err) {
      this.consecutiveFailures += 1
      this.lastError = err?.name === 'AbortError' ? `timeout after ${REQUEST_TIMEOUT_MS}ms` : err?.message
      console.warn(
        `[Search Tavily] searchWeb failed (failure #${this.consecutiveFailures}) `
        + `for "${query.slice(0, 80)}": ${this.lastError}`,
      )
      return []
    } finally {
      clearTimeout(timeout)
    }
  }

  // Tavily has no documented batch endpoint — run queries sequentially to
  // respect rate limits. The per-query cache makes repeat claims free.
  async batchSearch(queries, opts = {}) {
    const out = new Map()
    for (const q of queries) {
      out.set(q, await this.searchWeb(q, opts))
    }
    return out
  }

  async healthCheck() {
    return {
      provider: 'tavily',
      configured: !!this.apiKey,
      grounded: true,
      degraded: this.isDegraded(),
      lastError: this.lastError,
    }
  }
}
