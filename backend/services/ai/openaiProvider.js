import { createHash } from 'crypto'
import { AIProviderInterface } from './providerInterface.js'
import AIResponseCache from '../../models/AIResponseCache.js'
import AIUsageLog from '../../models/AIUsageLog.js'
import { aiLocalStorage } from '../../utils/aiContext.js'
import { calculateCost } from '../../utils/aiPricing.js'
import { checkUserBudget, incrementUserUsage } from '../../utils/aiUsage.js'
import {
  buildPortfolioContext,
  getPortfolioSummaryFallback,
  getAudienceOverlapFallback,
  getCrossPromotionFallback,
  getPortfolioContentGapsFallback,
  getCannibalizationFallback,
  getPortfolioStrategistFallback
} from '../../utils/portfolioContext.js'

// ── DeepSeekAPIError ───────────────────────────────────────────────────
// Mirrors the OpenAI SDK's APIError shape so existing catch blocks that read
// err.status / err.error?.code / err.error?.message / err.headers?.['x-request-id']
// keep working without changes. Thrown by _chatCompletions() on any non-2xx
// response or network failure.
export class DeepSeekAPIError extends Error {
  constructor({ status, code, message, requestId, cause }) {
    super(message || `${status || 'ERR'} ${code || 'deepseek_error'}`)
    this.name = 'DeepSeekAPIError'
    this.status = status ?? null
    this.error = { code: code || 'deepseek_error', message: message || '' }
    this.headers = requestId ? { 'x-request-id': requestId } : {}
    if (cause) this.cause = cause
  }
}

// Sleep helper with optional jitter (fraction of base delay).
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Per-method cache TTL configuration (hours) ──────────────────────────
const CACHE_TTL = {
  generateTweet: 24,
  generateThread: 24,
  analyzeTweet: 48,
  generateContentIdeas: 6,
  findTrendingTopics: 6,
  generateLinkedInPost: 24,
  generateThoughtLeadership: 24,
  analyzeLinkedInPost: 48,
  discoverIndustryTrends: 6,
  repurposeContent: 24,
  // Priority 1 — Content Intelligence
  analyzeTitle: 48,
  analyzeThumbnail: 48,
  analyzeScript: 48,
  simulatePerformance: 48,
  generateVideoIdeas: 12,
  generateShortsIdeas: 12,
  getStrategistTips: 6,
  getContentGaps: 12,
  summarizeAlerts: 6,
  generateCompetitorOpportunities: 24,
  // Production scripts are expensive to regenerate and stable once written —
  // cache for a week so revisit/regenerate-from-scratch is fast but still possible.
  generateProductionScript: 168,
  // Script Workspace 2.0 — creator-style-aware script generation
  analyzeCreatorStyle: 168,        // a channel's voice changes slowly — 1 week
  generateStyledScript: 168,       // stable per (channel, idea, mode)
  rewriteScript: 24,               // transform actions are cheaper, shorter-lived
  scoreScriptStyle: 24,
  // Research Workspace (Phase 2) — claim extraction is cheap-ish, but cache
  // to avoid re-running on unchanged script. analyzeScriptResearch is the
  // expensive final pass — cache a full day.
  extractScriptClaims: 6,
  analyzeScriptResearch: 24,
  // Portfolio Intelligence — expensive multi-channel computations, cache aggressively
  getPortfolioStrategist: 24,
  getAudienceOverlap: 24,
  getPortfolioContentGaps: 12,
  getCannibalization: 24,
  getCrossPromotion: 24,
  getPortfolioSummary: 12,
}

// ── Model tier: which methods get the premium model ─────────────────────
const PREMIUM_METHODS = new Set([
  'generateThoughtLeadership',
  'repurposeContent',
  'analyzeLinkedInPost',
  'analyzeTweet',
  'analyzeThumbnail', // needs vision → gpt-4o
  // Portfolio Intelligence — these need the larger model's reasoning capacity
  'getPortfolioStrategist',
  'getAudienceOverlap',
  'getPortfolioContentGaps',
  'getCannibalization',
  'getCrossPromotion',
  'getPortfolioSummary',
  // Production script generation — long-form structured reasoning
  'generateProductionScript',
  // Script Workspace 2.0 — creator-style analysis and generation
  'analyzeCreatorStyle',
  'generateStyledScript',
  'scoreScriptStyle',
  // Research Workspace — final pass combines claims + sources into a verdict.
  'analyzeScriptResearch',
])

function makeCacheKey(method, params) {
  const raw = method + '::' + JSON.stringify(params)
  return createHash('sha256').update(raw).digest('hex')
}

// ── Safely parse JSON from GPT response, with fallback ──────────────────
function parseJSON(text) {
  try {
    // Strip markdown fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

// ── Validators: ensure GPT output matches expected frontend shapes ──────
const VALIDATORS = {
  generateTweet(obj) {
    return obj
      && typeof obj.tweet === 'string'
      && Array.isArray(obj.variants)
      && Array.isArray(obj.hooks)
      && Array.isArray(obj.ctas)
      && Array.isArray(obj.hashtags)
  },
  generateThread(obj) {
    return obj
      && Array.isArray(obj.thread)
      && Array.isArray(obj.breakdown)
      && typeof obj.cta === 'string'
      && typeof obj.summary === 'string'
  },
  analyzeTweet(obj) {
    return obj
      && typeof obj.hookScore === 'number'
      && typeof obj.clarityScore === 'number'
      && typeof obj.engagementScore === 'number'
      && typeof obj.overallScore === 'number'
      && Array.isArray(obj.suggestions)
  },
  generateContentIdeas(obj) {
    return Array.isArray(obj) && obj.length > 0 && typeof obj[0].title === 'string'
  },
  findTrendingTopics(obj) {
    return Array.isArray(obj) && obj.length > 0 && typeof obj[0].topic === 'string'
  },
  generateLinkedInPost(obj) {
    return obj
      && typeof obj.post === 'string'
      && Array.isArray(obj.variants)
      && Array.isArray(obj.ctas)
      && Array.isArray(obj.hashtags)
  },
  generateThoughtLeadership(obj) {
    return obj
      && typeof obj.hook === 'string'
      && typeof obj.coreArgument === 'string'
      && Array.isArray(obj.supportingPoints)
      && typeof obj.authorityScore === 'number'
  },
  analyzeLinkedInPost(obj) {
    return obj
      && typeof obj.hookScore === 'number'
      && typeof obj.overallScore === 'number'
      && Array.isArray(obj.suggestions)
  },
  discoverIndustryTrends(obj) {
    return Array.isArray(obj) && obj.length > 0 && typeof obj[0].trendName === 'string'
  },
  repurposeContent(obj) {
    return obj
      && typeof obj.shortPost === 'string'
      && typeof obj.longPost === 'string'
      && Array.isArray(obj.carouselOutline)
  },
  // ── Priority 1: Content Intelligence ──────────────────────────────────
  analyzeTitle(obj) {
    return obj
      && typeof obj.hookScore === 'number'
      && typeof obj.clarityScore === 'number'
      && typeof obj.seoScore === 'number'
      && typeof obj.emotionalScore === 'number'
      && typeof obj.overallScore === 'number'
      && Array.isArray(obj.suggestions)
      && Array.isArray(obj.variants)
  },
  analyzeScript(obj) {
    return obj
      && typeof obj.viral === 'number'
      && typeof obj.retention === 'number'
      && typeof obj.interest === 'number'
      && typeof obj.watchTime === 'number'
      && Array.isArray(obj.weakSections)
      && Array.isArray(obj.rewrites)
      && Array.isArray(obj.hooks)
  },
  simulatePerformance(obj) {
    return obj
      && typeof obj.viralProbability === 'number'
      && typeof obj.predictedCTR === 'number'
      && typeof obj.predictedRetention === 'number'
      && typeof obj.estimatedViews === 'string'
      && typeof obj.recommendationScore === 'number'
      && Array.isArray(obj.strengths)
      && Array.isArray(obj.weaknesses)
      && Array.isArray(obj.optimizationSuggestions)
      && Array.isArray(obj.riskWarnings)
  },
  analyzeThumbnail(obj) {
    return obj
      && typeof obj.ctr === 'number'
      && typeof obj.attention === 'number'
      && typeof obj.clutter === 'number'
      && typeof obj.face === 'number'
      && typeof obj.contrast === 'number'
      && Array.isArray(obj.improvements)
  },
  generateVideoIdeas(obj) {
    if (!obj || !Array.isArray(obj.ideas) || obj.ideas.length === 0) return false
    return obj.ideas.every((i) =>
      typeof i.id === 'number'
      && typeof i.title === 'string'
      && typeof i.whyRecommend === 'string'
      && typeof i.predictedViews === 'string'
      && typeof i.predictedEngagement === 'string'
      && typeof i.difficulty === 'number'
      && typeof i.opportunity === 'number'
      && typeof i.trendScore === 'number'
      && typeof i.tag === 'string'
      && typeof i.badgeColor === 'string'
    )
  },
  generateShortsIdeas(obj) {
    if (!obj || !Array.isArray(obj.ideas) || obj.ideas.length === 0) return false
    return obj.ideas.every((i) =>
      typeof i.id === 'number'
      && typeof i.title === 'string'
      && typeof i.hook === 'string'
      && typeof i.first3s === 'string'
      && typeof i.cta === 'string'
      && typeof i.retention === 'string'
      && typeof i.viralScore === 'number'
      && typeof i.trendStrength === 'number'
    )
  },
  // Permissive validator: the schema is intentionally flexible so the AI can
  // decide which optional fields each timeline section needs. We only enforce
  // the minimum shape required for the frontend to render anything meaningful.
  generateProductionScript(obj) {
    if (!obj || typeof obj !== 'object') return false
    if (typeof obj.overview !== 'string' || obj.overview.trim().length === 0) return false
    if (!Array.isArray(obj.timeline) || obj.timeline.length === 0) return false
    return obj.timeline.every((block) =>
      block
      && typeof block === 'object'
      && typeof block.sectionName === 'string'
      && (typeof block.narration === 'string' || Array.isArray(block.narration))
      && (block.timestamp === undefined || typeof block.timestamp === 'string')
    )
  },
  getStrategistTips(obj) {
    if (!obj || !Array.isArray(obj.tips) || obj.tips.length === 0) return false
    return obj.tips.every((t) =>
      typeof t.id === 'number'
      && typeof t.text === 'string'
      && ['positive', 'warning', 'info'].includes(t.type)
    )
  },
  getContentGaps(obj) {
    if (!obj || !Array.isArray(obj.gaps) || obj.gaps.length === 0) return false
    return obj.gaps.every((g) =>
      typeof g.id === 'number'
      && typeof g.topic === 'string'
      && typeof g.opportunity === 'string'
    )
  },
  summarizeAlerts(obj) {
    if (!obj || typeof obj.summary !== 'string') return false
    if (!Array.isArray(obj.topRisks) || !Array.isArray(obj.topOpportunities)) return false
    const itemOk = (i) => i && typeof i.title === 'string' && typeof i.desc === 'string'
    return obj.topRisks.every(itemOk) && obj.topOpportunities.every(itemOk)
  },
  // ── Portfolio Intelligence ────────────────────────────────────────────
  getPortfolioStrategist(obj) {
    return obj
      && typeof obj.healthScore === 'number'
      && typeof obj.stabilityScore === 'number'
      && Array.isArray(obj.recommendations)
      && Array.isArray(obj.actionCenter)
      && Array.isArray(obj.growthRadar)
  },
  getAudienceOverlap(obj) {
    if (!obj || !Array.isArray(obj.pairs)) return false
    return obj.pairs.every((p) =>
      typeof p.channelAId === 'string'
      && typeof p.channelBId === 'string'
      && typeof p.overlap === 'number'
    )
  },
  getPortfolioContentGaps(obj) {
    if (!obj || !Array.isArray(obj.gaps)) return false
    return obj.gaps.every((g) =>
      typeof g.topic === 'string'
      && typeof g.opportunityScore === 'number'
    )
  },
  getCannibalization(obj) {
    return obj && Array.isArray(obj.warnings)
  },
  getCrossPromotion(obj) {
    return obj && Array.isArray(obj.promotions)
  },
  getPortfolioSummary(obj) {
    return obj
      && typeof obj.channelsCount === 'number'
      && Array.isArray(obj.channels)
  },
  generateCompetitorOpportunities(obj) {
    return obj
      && Array.isArray(obj.opportunities)
      && obj.opportunities.every(o =>
        o
        && typeof o.title === 'string'
        && typeof o.opportunityLevel === 'string'
        && typeof o.estimatedSearchVolume === 'string'
        && typeof o.reason === 'string'
      )
  },
  // ── Script Workspace 2.0 ─────────────────────────────────────────────
  analyzeCreatorStyle(obj) {
    if (!obj || typeof obj !== 'object') return false
    if (typeof obj.summary !== 'string') return false
    // Permissive: the style profile is mostly soft signals — we only require
    // that the AI returned a summary string and at least one structured
    // signal it chose to surface. Specific sub-keys (languageMix, hookStyle,
    // etc.) are best-effort and not enforced.
    return true
  },
  generateStyledScript(obj) {
    if (!obj || typeof obj !== 'object') return false
    if (typeof obj.title !== 'string') return false
    if (typeof obj.hook !== 'string') return false
    if (typeof obj.fullScript !== 'string' || obj.fullScript.trim().length === 0) return false
    if (typeof obj.cta !== 'string') return false
    // styleMatch is required — the differentiator of this whole feature.
    if (!obj.styleMatch || typeof obj.styleMatch !== 'object') return false
    if (typeof obj.styleMatch.overall !== 'number') return false
    return true
  },
  rewriteScript(obj) {
    if (!obj || typeof obj !== 'object') return false
    if (typeof obj.fullScript !== 'string' || obj.fullScript.trim().length === 0) return false
    return true
  },
  scoreScriptStyle(obj) {
    if (!obj || typeof obj !== 'object') return false
    if (!obj.styleMatch || typeof obj.styleMatch !== 'object') return false
    if (typeof obj.styleMatch.overall !== 'number') return false
    return true
  },
  // Research Workspace (Phase 2) — accept either a bare array of claims
  // OR the { claims: [...] } wrapper the prompt instructs the model to
  // return. Normalize internally so the rest of the pipeline doesn't care.
  extractScriptClaims(obj) {
    const arr = Array.isArray(obj) ? obj : obj?.claims
    return Array.isArray(arr) && arr.every((c) =>
      c && typeof c.text === 'string' && typeof c.type === 'string'
    )
  },
  // Final research pass returns the report shape: claims with verdicts,
  // structured suggestions, missing-context list, and a researchScore.
  analyzeScriptResearch(obj) {
    if (!obj || typeof obj !== 'object') return false
    if (!Array.isArray(obj.claims)) return false
    if (!Array.isArray(obj.suggestions)) return false
    if (!Array.isArray(obj.missingContext)) return false
    if (!obj.researchScore || typeof obj.researchScore !== 'object') return false
    if (typeof obj.researchScore.overall !== 'number') return false
    return true
  },
}


export class OpenAIProvider extends AIProviderInterface {
  constructor(apiKey) {
    super()
    this.apiKey = apiKey

    // DeepSeek V4 (or any OpenAI-compatible gateway) — base URL stripping.
    // Accepts both "https://.../openai/v1" and the full "https://.../openai/v1/chat/completions"
    // form so operators can paste either without breaking.
    const rawBaseURL = process.env.DEEPSEEK_BASE_URL || ''
    this.baseURL = rawBaseURL.replace(/\/chat\/completions\/?$/, '').replace(/\/+$/, '')

    // DeepSeek V4 exposes one model; the fast/premium tier distinction collapses.
    // Both fields point at DEEPSEEK_MODEL so PREMIUM_METHODS / _getModel() stay
    // semantically valid but become a no-op.
    this.fastModel = process.env.DEEPSEEK_MODEL
    this.premiumModel = process.env.DEEPSEEK_MODEL
    if (!this.fastModel || !this.premiumModel) {
      throw new Error(
        'DEEPSEEK_MODEL must be set when AI_PROVIDER=deepseek. '
        + 'The deployment has no default model.'
      )
    }

    this.timeoutMs = parseInt(process.env.DEEPSEEK_TIMEOUT_MS, 10) || 120000
    this.maxRetries = parseInt(process.env.DEEPSEEK_MAX_RETRIES, 10) || 2

    this.dailyBudget = parseFloat(process.env.DEEPSEEK_DAILY_BUDGET_USD) || Infinity
    this.monthlyBudget = parseFloat(process.env.DEEPSEEK_MONTHLY_BUDGET_USD) || Infinity
    // Subclass hooks: keep these as instance fields so GroqProvider (or any
    // other OpenAI-compatible provider) can override them in its constructor
    // without duplicating _execute / analyzeThumbnail / _checkBudget.
    this.providerKey = 'deepseek'        // stored on AIResponseCache.provider
    this.providerLabel = 'DeepSeek'      // used in error messages
    this.logPrefix = '[AI DeepSeek]'     // used in console.log success lines

    console.log(
      `[AI DeepSeek] Initializing — baseURL=${this.baseURL}, `
      + `model=${this.fastModel}`
    )
    // Boot-time diagnostic — proves which key the provider is actually using
    // WITHOUT exposing the secret. Hash is sha256(key) first 16 hex chars;
    // safe to log, not reversible. Compare across environments to detect
    // stale/rotated/whitespace-corrupted values.
    const keyHash = createHash('sha256').update(String(this.apiKey)).digest('hex').slice(0, 16)
    console.log('[AI DeepSeek] Credential fingerprint', {
      apiKeyConfigured: !!this.apiKey,
      apiKeyLength: this.apiKey ? this.apiKey.length : 0,
      apiKeyHash: keyHash,
      apiKeyHasWhitespace: this.apiKey ? /\s/.test(this.apiKey) : null,
      apiKeyHasQuotes: this.apiKey ? /^[\"']|[\"']$/.test(this.apiKey) : null,
      baseURL: this.baseURL,
      model: this.fastModel,
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
      aiProvider: process.env.AI_PROVIDER,
      nodeEnv: process.env.NODE_ENV,
      vercel: process.env.VERCEL,
    })
  }

  // ── Chat Completions transport (OpenAI-compatible fetch) ─────────────
  // Single internal helper replacing the OpenAI SDK. Sends both auth headers
  // (Authorization: Bearer + api-key) so Azure AI Foundry, direct DeepSeek,
  // and Groq all accept the call. Retries 408/409/429/>=500 with exp backoff.
  // Throws DeepSeekAPIError shaped like the SDK's APIError so the catch
  // blocks in _execute / analyzeThumbnail / simulatePerformance read the
  // same .status / .error.code / .headers fields unchanged.
  async _chatCompletions({ model, messages, temperature, response_format }) {
    const url = `${this.baseURL}/chat/completions`
    const body = JSON.stringify({
      model,
      messages,
      ...(temperature != null ? { temperature } : {}),
      ...(response_format ? { response_format } : {}),
    })

    const baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'api-key': this.apiKey,
    }

    let lastError
    const attempts = Math.max(0, this.maxRetries) + 1
    for (let attempt = 0; attempt < attempts; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeoutMs)
      let res
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: baseHeaders,
          body,
          signal: controller.signal,
        })
      } catch (networkErr) {
        clearTimeout(timer)
        const aborted = networkErr?.name === 'AbortError'
        lastError = new DeepSeekAPIError({
          status: aborted ? 408 : null,
          code: aborted ? 'request_timeout' : 'network_error',
          message: aborted
            ? `Request timed out after ${this.timeoutMs}ms`
            : (networkErr?.message || 'Network error'),
          cause: networkErr,
        })
        // Network errors are retryable.
        if (attempt < attempts - 1) {
          await sleep(this._backoffMs(attempt))
          continue
        }
        throw lastError
      }
      clearTimeout(timer)

      const requestId = res.headers.get('x-request-id') || null

      if (!res.ok) {
        let errBody = null
        try { errBody = await res.json() } catch { try { errBody = await res.text() } catch {} }
        const code = (errBody && typeof errBody === 'object'
          ? (errBody.error?.code || errBody.code)
          : null) || `http_${res.status}`
        const message = (errBody && typeof errBody === 'object'
          ? (errBody.error?.message || errBody.message)
          : (typeof errBody === 'string' ? errBody : null)) || res.statusText

        lastError = new DeepSeekAPIError({ status: res.status, code, message, requestId })

        const retryable = res.status === 408 || res.status === 409 || res.status === 429 || res.status >= 500
        if (retryable && attempt < attempts - 1) {
          // Honor Retry-After on 429 if present.
          const retryAfter = res.headers.get('retry-after')
          const delay = retryAfter
            ? Math.min(parseInt(retryAfter, 10) * 1000 || this._backoffMs(attempt), this.timeoutMs)
            : this._backoffMs(attempt)
          await sleep(delay)
          continue
        }
        throw lastError
      }

      // 2xx — parse and return shaped like OpenAI SDK's completion object.
      let parsed
      try {
        parsed = await res.json()
      } catch (parseErr) {
        throw new DeepSeekAPIError({
          status: res.status,
          code: 'invalid_json',
          message: `Failed to parse response JSON: ${parseErr.message}`,
          requestId,
          cause: parseErr,
        })
      }
      return parsed
    }
    // Exhausted retries — throw the last seen error (or a generic fallback).
    throw lastError || new DeepSeekAPIError({ code: 'unknown', message: 'Exhausted retries' })
  }

  // Exponential backoff: 500ms × 1.5^attempt ± 25% jitter.
  _backoffMs(attempt) {
    const base = 500 * Math.pow(1.5, attempt)
    const jitter = base * 0.25 * (Math.random() * 2 - 1)
    return Math.max(0, Math.round(base + jitter))
  }

  // ── Core execution pipeline ───────────────────────────────────────────

  async healthCheck() {
    return {
      provider: this.providerKey,
      baseURL: this.baseURL,
      fastModel: this.fastModel,
      premiumModel: this.premiumModel,
      apiKeyConfigured: !!this.apiKey,
      dailyBudget: this.dailyBudget === Infinity ? null : this.dailyBudget,
      monthlyBudget: this.monthlyBudget === Infinity ? null : this.monthlyBudget,
    }
  }

  _getModel(method) {
    return PREMIUM_METHODS.has(method) ? this.premiumModel : this.fastModel
  }

  async _checkBudget(userId) {
    if (userId) {
      await checkUserBudget(userId)
      return
    }

    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [dailyAgg, monthlyAgg] = await Promise.all([
      AIUsageLog.aggregate([
        { $match: { createdAt: { $gte: startOfDay }, cacheHit: false } },
        { $group: { _id: null, total: { $sum: '$estimatedCost' } } }
      ]),
      AIUsageLog.aggregate([
        { $match: { createdAt: { $gte: startOfMonth }, cacheHit: false } },
        { $group: { _id: null, total: { $sum: '$estimatedCost' } } }
      ])
    ])

    const dailySpend = dailyAgg[0]?.total || 0
    const monthlySpend = monthlyAgg[0]?.total || 0

    if (dailySpend >= this.dailyBudget) {
      throw new Error(`${this.providerLabel} daily budget exceeded ($${dailySpend.toFixed(4)} / $${this.dailyBudget})`)
    }
    if (monthlySpend >= this.monthlyBudget) {
      throw new Error(`${this.providerLabel} monthly budget exceeded ($${monthlySpend.toFixed(4)} / $${this.monthlyBudget})`)
    }
  }

  async _execute(method, params, systemPrompt, userPrompt, options = {}) {
    if (!this.apiKey) throw new Error(`${this.providerLabel} API Key not configured`)

    const store = aiLocalStorage.getStore()
    const userId = store?.userId
    const cacheKey = makeCacheKey(method, params)

    // 1. Check cache
    try {
      const cached = userId
        ? await AIResponseCache.findOne({ cacheKey, userId })
        : await AIResponseCache.findOne({ cacheKey })
      if (cached) {
        // Log cache hit
        AIUsageLog.create({
          method,
          model: cached.usage?.model || this.fastModel,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
          responseTimeMs: 0,
          success: true,
          cacheHit: true,
          userId,
          provider: this.providerKey,
          params
        }).catch(() => {})  // fire-and-forget

        if (userId) {
          await incrementUserUsage(userId, { spend: 0, tokens: 0, cacheHit: true })
        }

        console.log(`[AI Cache HIT] ${method} — returning cached response`)
        return cached.response
      }
    } catch (cacheErr) {
      console.warn('[AI Cache] Read error:', cacheErr.message)
    }

    // 2. Check budget
    await this._checkBudget(userId)

    // 3. Call DeepSeek (or OpenAI-compatible gateway via _chatCompletions)
    const model = options.model || this._getModel(method)
    const temperature = options.temperature ?? 0.8
    const startTime = Date.now()

    // userContent may be a string (text-only) or an array (vision: text + image_url).
    const userContent = options.userContent || userPrompt

    let completion
    try {
      completion = await this._chatCompletions({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature
      })
    } catch (err) {
      // _chatCompletions throws DeepSeekAPIError shaped like the OpenAI SDK's
      // APIError — .status, .error.code, .error.message, .headers['x-request-id'].
      // For 401/403 (auth-class) failures, also log the credential fingerprint
      // — that's the only way to prove whether the key that actually left the
      // process matches the one in your local .env. Hash, not the value.
      const isAuthError = err.status === 401 || err.status === 403
      const keyHash = createHash('sha256').update(String(this.apiKey)).digest('hex').slice(0, 16)
      console.error(`[AI DeepSeek] ${method} call failed —`, {
        status: err.status,
        code: err.error?.code,
        message: err.error?.message || err.message,
        baseURL: this.baseURL,
        model,
        requestId: err.headers?.['x-request-id'] || null,
        ...(isAuthError
          ? {
              credentialFingerprint: {
                apiKeyConfigured: !!this.apiKey,
                apiKeyLength: this.apiKey ? this.apiKey.length : 0,
                apiKeyHash: keyHash,
                apiKeyHasWhitespace: this.apiKey ? /\s/.test(this.apiKey) : null,
                apiKeyHasQuotes: this.apiKey ? /^[\"']|[\"']$/.test(this.apiKey) : null,
              },
            }
          : {}),
      })
      throw err
    }

    const responseTimeMs = Date.now() - startTime
    const rawContent = completion.choices?.[0]?.message?.content || '{}'
    const usage = completion.usage || {}
    const promptTokens = usage.prompt_tokens || 0
    const completionTokens = usage.completion_tokens || 0
    const totalTokens = usage.total_tokens || promptTokens + completionTokens
    const cost = calculateCost({ provider: 'openai', model, promptTokens, completionTokens })

    let parsed = parseJSON(rawContent)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (method === 'generateContentIdeas' && Array.isArray(parsed.ideas)) {
        parsed = parsed.ideas
      } else if (method === 'findTrendingTopics' && Array.isArray(parsed.topics)) {
        parsed = parsed.topics
      } else if (method === 'discoverIndustryTrends' && Array.isArray(parsed.trends)) {
        parsed = parsed.trends
      }
    }
    const validator = VALIDATORS[method]

    if (!parsed || (validator && !validator(parsed))) {
      // Print enough context to debug without re-running: the model used,
      // the received top-level shape, and a head/tail of the raw payload.
      // Full raw is intentionally truncated to keep logs readable.
      const receivedShape = parsed == null
        ? 'null / not JSON'
        : Array.isArray(parsed)
          ? `array[length=${parsed.length}]`
          : `object{keys=[${Object.keys(parsed).slice(0, 12).join(',')}]}`

      console.error(`[AI Validation FAIL] ${method}`, {
        provider: this.providerKey,
        model,
        responseTimeMs,
        promptTokens,
        completionTokens,
        requestId: completion?.id || null,
        parseFailed: parsed == null,
        receivedShape,
        rawHead: rawContent.slice(0, 600),
        rawTail: rawContent.slice(-200),
      })
      // Log the failed parse attempt
      AIUsageLog.create({
        method, model, promptTokens, completionTokens, totalTokens,
        estimatedCost: cost, responseTimeMs,
        success: false,
        error: `Invalid JSON structure from ${this.providerLabel}`,
        cacheHit: false, params,
        userId,
        provider: this.providerKey
      }).catch(() => {})
      throw new Error(`${this.providerLabel} returned invalid JSON structure for ${method}`)
    }

    // 5. Cache response
    const ttlHours = CACHE_TTL[method] || 24
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)
    try {
      await AIResponseCache.findOneAndUpdate(
        userId ? { cacheKey, userId } : { cacheKey },
        {
          cacheKey, method, params,
          response: parsed,
          provider: this.providerKey,
          userId,
          usage: { promptTokens, completionTokens, totalTokens, model, estimatedCost: cost },
          responseTimeMs,
          expiresAt
        },
        { upsert: true, new: true }
      )
    } catch (cacheErr) {
      console.warn('[AI Cache] Write error:', cacheErr.message)
    }

    // 6. Log usage
    AIUsageLog.create({
      method, model, promptTokens, completionTokens, totalTokens,
      estimatedCost: cost, responseTimeMs,
      success: true, cacheHit: false, params,
      userId,
      provider: this.providerKey
    }).catch(() => {})

    if (userId) {
      await incrementUserUsage(userId, { spend: cost, tokens: totalTokens, cacheHit: false })
    }

    console.log(`${this.logPrefix} ${method} — ${model} — ${totalTokens} tokens — $${cost.toFixed(6)} — ${responseTimeMs}ms`)
    return parsed
  }


  // ── Twitter Methods ───────────────────────────────────────────────────

  async generateTweet(topic, audience, tone, goal) {
    const systemPrompt = `You are an expert Twitter/X content strategist. Generate a high-performing tweet and supporting content.
Return ONLY valid JSON with this exact structure:
{
  "tweet": "the main tweet text (max 280 chars)",
  "variants": ["alternative version 1", "alternative version 2"],
  "hooks": ["hook option 1", "hook option 2"],
  "ctas": ["call to action 1", "call to action 2"],
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
}`

    const userPrompt = `Create a viral tweet about: "${topic}"
Target audience: ${audience || 'general'}
Tone: ${tone || 'professional'}
Goal: ${goal || 'engagement'}`

    return this._execute('generateTweet', { topic, audience, tone, goal }, systemPrompt, userPrompt)
  }

  async generateThread(topic, count, style) {
    const threadCount = count || 5
    const systemPrompt = `You are an expert Twitter/X thread writer. Create a compelling thread.
Return ONLY valid JSON with this exact structure:
{
  "thread": ["1/ first tweet...", "2/ second tweet...", ...],
  "breakdown": [{"node": 1, "text": "first tweet..."}, {"node": 2, "text": "second tweet..."}, ...],
  "cta": "final call-to-action tweet",
  "summary": "one-line summary of the thread"
}
Generate exactly ${threadCount} tweets in the thread.`

    const userPrompt = `Write a ${threadCount}-part Twitter thread about: "${topic}"
Style: ${style || 'educational'}
Make each tweet compelling and under 280 characters.`

    return this._execute('generateThread', { topic, count: threadCount, style }, systemPrompt, userPrompt)
  }

  async analyzeTweet(text) {
    const systemPrompt = `You are a social media analytics expert. Analyze the given tweet for quality metrics.
Return ONLY valid JSON with this exact structure:
{
  "hookScore": <number 0-100>,
  "clarityScore": <number 0-100>,
  "engagementScore": <number 0-100>,
  "shareabilityScore": <number 0-100>,
  "overallScore": <number 0-100>,
  "suggestions": ["specific improvement 1", "specific improvement 2", "specific improvement 3"]
}
Be honest and critical. Provide actionable suggestions.`

    const userPrompt = `Analyze this tweet:\n\n"${text}"`

    return this._execute('analyzeTweet', { text }, systemPrompt, userPrompt)
  }

  async generateContentIdeas(category) {
    const systemPrompt = `You are a content strategy researcher. Generate trending content ideas for the given category.
Return ONLY valid JSON with this structure:
{
  "ideas": [
    {"id": "1", "title": "content idea title", "impact": "High|Medium|Viral"},
    {"id": "2", "title": "another idea", "impact": "High|Medium|Viral"}
  ]
}
Generate 5-8 unique, timely ideas.`

    const userPrompt = `Generate trending content ideas for the category: "${category}"
Focus on current trends in 2026. Make them specific and actionable.`

    return this._execute('generateContentIdeas', { category }, systemPrompt, userPrompt)
  }

  async findTrendingTopics(category) {
    const systemPrompt = `You are a trend analyst. Identify currently trending topics in the given category.
Return ONLY valid JSON with this structure:
{
  "topics": [
    {"topic": "topic name", "trendScore": <number 70-100>, "growth": <number like 84.5>, "competition": "Low|Medium|High", "opportunityScore": <number 70-100>}
  ]
}
Generate 4-6 trending topics with realistic metrics.`

    const userPrompt = `What are the trending topics in: "${category}"?
Focus on topics with high growth potential in 2026.`

    return this._execute('findTrendingTopics', { category }, systemPrompt, userPrompt)
  }


  // ── LinkedIn Methods ──────────────────────────────────────────────────

  async generateLinkedInPost(topic, industry, audience, goal, tone) {
    const systemPrompt = `You are a LinkedIn ghostwriter specializing in B2B thought leadership. Write a high-performing LinkedIn post.
Return ONLY valid JSON with this exact structure:
{
  "post": "the full LinkedIn post text (500-1500 chars, use \\n for line breaks)",
  "variants": ["alternative version 1", "alternative version 2"],
  "ctas": ["call to action 1"],
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4"]
}
Use professional B2B language. Include line breaks for readability.`

    const userPrompt = `Write a LinkedIn post about: "${topic}"
Industry: ${industry || 'Technology'}
Target audience: ${audience || 'Business professionals'}
Goal: ${goal || 'Thought Leadership'}
Tone: ${tone || 'professional'}`

    return this._execute('generateLinkedInPost', { topic, industry, audience, goal, tone }, systemPrompt, userPrompt)
  }

  async generateThoughtLeadership(topic, category) {
    const systemPrompt = `You are a thought leadership strategist. Build a contrarian, authority-establishing LinkedIn post framework.
Return ONLY valid JSON with this exact structure:
{
  "hook": "attention-grabbing opening line (contrarian or surprising)",
  "coreArgument": "the main thesis in 2-3 sentences",
  "supportingPoints": ["evidence point 1", "evidence point 2", "evidence point 3"],
  "cta": "closing call-to-action",
  "authorityScore": <number 80-100>,
  "viralityPotential": <number 70-100>,
  "leadPotentialScore": <number 75-100>,
  "impactScore": <number 80-100>
}
Be bold and contrarian. Challenge conventional wisdom.`

    const userPrompt = `Create a thought leadership framework about: "${topic}"
Category: ${category || 'Technology'}
Make it contrarian and backed by strong reasoning.`

    return this._execute('generateThoughtLeadership', { topic, category }, systemPrompt, userPrompt)
  }

  async analyzeLinkedInPost(text) {
    const systemPrompt = `You are a LinkedIn content performance analyst. Analyze the given post for quality and impact.
Return ONLY valid JSON with this exact structure:
{
  "hookScore": <number 0-100>,
  "clarityScore": <number 0-100>,
  "authorityScore": <number 0-100>,
  "engagementScore": <number 0-100>,
  "leadGenPotential": <number 0-100>,
  "overallScore": <number 0-100>,
  "suggestions": ["specific improvement 1", "specific improvement 2", "specific improvement 3"]
}
Be analytical and provide actionable feedback.`

    const userPrompt = `Analyze this LinkedIn post:\n\n"${text}"`

    return this._execute('analyzeLinkedInPost', { text }, systemPrompt, userPrompt)
  }

  async discoverIndustryTrends(category) {
    const systemPrompt = `You are a B2B industry trend analyst. Identify emerging trends and suggest content angles.
Return ONLY valid JSON with this structure:
{
  "trends": [
    {"trendName": "trend name", "growth": <number like 84.5>, "opportunityScore": <number 70-100>, "suggestedAngle": "content angle suggestion"}
  ]
}
Generate 3-5 trends with realistic growth metrics.`

    const userPrompt = `What are the emerging B2B industry trends in: "${category}"?
Focus on trends that LinkedIn thought leaders should cover in 2026.`

    return this._execute('discoverIndustryTrends', { category }, systemPrompt, userPrompt)
  }

  async repurposeContent(sourceText, targetFormat) {
    const systemPrompt = `You are a content repurposing specialist. Transform the given content into multiple LinkedIn formats.
Return ONLY valid JSON with this exact structure:
{
  "shortPost": "concise LinkedIn post (under 300 chars) with hashtags",
  "longPost": "detailed LinkedIn article-style post (500-1500 chars)",
  "thoughtLeadership": "contrarian thought-leadership angle post",
  "carouselOutline": ["Slide 1: ...", "Slide 2: ...", "Slide 3: ...", "Slide 4: ..."]
}
Adapt the voice for professional LinkedIn audiences. Use line breaks.`

    const userPrompt = `Repurpose this ${targetFormat || 'content'} into LinkedIn formats:\n\n"${sourceText}"`

    return this._execute('repurposeContent', { sourceText: sourceText?.substring(0, 2000), targetFormat }, systemPrompt, userPrompt)
  }

  // ── Priority 1: YouTube Content Intelligence ──────────────────────────

  async analyzeTitle(payload = {}) {
    const title = (payload.title || payload.text || '').toString().trim()
    if (!title) throw new Error('analyzeTitle requires a non-empty title')

    const systemPrompt = `You are a YouTube click-through-rate (CTR) specialist who has analyzed thousands of viral video titles.
Return ONLY valid JSON with this exact structure:
{
  "hookScore": <number 0-100>,
  "clarityScore": <number 0-100>,
  "seoScore": <number 0-100>,
  "emotionalScore": <number 0-100>,
  "overallScore": <number 0-100>,
  "suggestions": ["specific actionable improvement 1", "...", "specific actionable improvement 3"],
  "variants": ["improved title variant 1", "improved title variant 2", "improved title variant 3"]
}
Scoring rubric:
- hookScore: strength of the curiosity/value/emotional trigger in the first 4 words
- clarityScore: how clearly the topic and payoff are communicated
- seoScore: presence of searchable keywords and intent match
- emotionalScore: intensity of emotion (surprise, awe, anger, inspiration)
- overallScore: weighted average
Suggestions must be specific to THIS title — no generic advice.
Variants must each be under 70 characters and CTR-optimized.`

    const userPrompt = `Analyze and improve this YouTube video title:\n\n"${title}"\n\nChannel niche (if known): ${payload.niche || 'general'}`

    return this._execute('analyzeTitle', { title: title.substring(0, 200) }, systemPrompt, userPrompt, {
      temperature: 0.4,
    })
  }

  async analyzeScript(payload = {}) {
    const script = (payload.script || '').toString().trim()
    if (!script) throw new Error('analyzeScript requires a non-empty script')

    const systemPrompt = `You are a YouTube script pacing and retention specialist who has analyzed retention graphs of thousands of highly successful videos.
Return ONLY valid JSON with this exact structure:
{
  "viral": <number 0-100, overall virality potential score>,
  "retention": <number 0-100, estimated overall retention score>,
  "interest": <number 0-100, audience interest score>,
  "watchTime": <number, forecast average watch time in minutes>,
  "weakSections": [
    {
      "time": "<estimated time stamp, e.g. 0:15 or 1:40>",
      "problem": "<short description of the pacing/interest drop problem>",
      "fix": "<specific actionable advice on how to rewrite or edit this section to maintain viewer retention>"
    }
  ],
  "rewrites": [
    {
      "original": "<precise short quote of the weak opening hook or drop-off sentence>",
      "alternative": "<completely rewritten high-impact CTR-optimized or retention-optimized script section>"
    }
  ],
  "hooks": [
    "<general rule 1 for hook delivery/pacing>",
    "<general rule 2 for hook delivery/pacing>"
  ]
}
Be rigorous, analytical, and critical. Focus on identifying precise locations in the script where audience attention is likely to drop.`

    const userPrompt = `Analyze the pacing and storytelling of this YouTube video script:\n\n"${script}"`

    try {
      return await this._execute('analyzeScript', { script: script.substring(0, 2000) }, systemPrompt, userPrompt, {
        temperature: 0.6,
      })
    } catch (error) {
      console.error('Script Analysis Provider Error:', error)
      throw error
    }
  }

  async simulatePerformance(payload = {}) {
    const title = (payload.title || '').toString().trim()
    const duration = payload.duration || 10
    const script = payload.script || ''
    const thumbnail = payload.thumbnail || '' // Base64 data URL if present
    const channelId = payload.channelId

    const systemPrompt = `You are a YouTube algorithm simulator. Analyze a video concept (title, duration, script, and optional thumbnail design) to predict its algorithmic reach, viewer click-through behavior, and retention dynamics.
Return ONLY valid JSON matching this exact structure:
{
  "viralProbability": <number 0-100, probability of algorithm promoting the video to a wider audience>,
  "predictedCTR": <number, predicted click-through-rate percentage (e.g. 5.4)>,
  "predictedRetention": <number 0-100, predicted average retention percentage>,
  "estimatedViews": "<range string, e.g. '10K - 30K' or '150K - 400K'>",
  "recommendationScore": <number 0-100, overall performance recommendation score>,
  "strengths": ["specific structural strength 1", "specific structural strength 2"],
  "weaknesses": ["specific structural weakness 1", "specific structural weakness 2"],
  "optimizationSuggestions": ["actionable optimization suggestion 1", "actionable optimization suggestion 2"],
  "riskWarnings": ["potential performance risk factor 1", "potential performance risk factor 2"]
}
Rubric:
- Analyze how title keywords match target audience interests.
- If a script is present, analyze hook timing and narrative pacing.
- If a thumbnail is present, evaluate its visual appeal, contrast, clutter, and text readability.
Be realistic, analytical, and highly critical. Do not write generic feedback.`

    const userPrompt = `Simulate video performance with these parameters:
Title: "${title}"
Duration: ${duration} minutes
Script details: ${script ? `"${script}"` : '(None provided)'}
Thumbnail design: ${thumbnail ? 'Base64 image design attached for visual analysis.' : '(No thumbnail draft uploaded)'}`

    try {
      if (thumbnail) {
        if (!this.apiKey) throw new Error(`${this.providerLabel} API Key not configured`)
        const store = aiLocalStorage.getStore()
        const userId = store?.userId

        await this._checkBudget(userId)

        const model = this.premiumModel
        const startTime = Date.now()

        console.log(`[AI DeepSeek] Executing simulatePerformance (vision call) using model: ${model}`)
        const completion = await this._chatCompletions({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                { type: 'image_url', image_url: { url: thumbnail } }
              ]
            }
          ],
          temperature: 0.5
        })

        const responseTimeMs = Date.now() - startTime
        const rawContent = completion.choices?.[0]?.message?.content || '{}'
        const usage = completion.usage || {}
        const promptTokens = usage.prompt_tokens || 0
        const completionTokens = usage.completion_tokens || 0
        const totalTokens = usage.total_tokens || promptTokens + completionTokens
        const cost = calculateCost({ provider: 'openai', model, promptTokens, completionTokens })

        const parsed = parseJSON(rawContent)
        if (!parsed || !VALIDATORS.simulatePerformance(parsed)) {
          AIUsageLog.create({
            method: 'simulatePerformance', model, promptTokens, completionTokens, totalTokens,
            estimatedCost: cost, responseTimeMs,
            success: false, error: `Invalid JSON structure from ${this.providerLabel}`,
            cacheHit: false, params: { title, duration, scriptLength: script.length, hasThumbnail: true },
            userId, provider: this.providerKey
          }).catch(() => {})
          throw new Error(`${this.providerLabel} returned invalid JSON structure for simulatePerformance`)
        }

        AIUsageLog.create({
          method: 'simulatePerformance', model, promptTokens, completionTokens, totalTokens,
          estimatedCost: cost, responseTimeMs,
          success: true, cacheHit: false, params: { title, duration, scriptLength: script.length, hasThumbnail: true },
          userId, provider: this.providerKey
        }).catch(() => {})

        if (userId) {
          await incrementUserUsage(userId, { spend: cost, tokens: totalTokens, cacheHit: false })
        }

        console.log(`${this.logPrefix} simulatePerformance (vision) — ${model} — ${totalTokens} tokens — $${cost.toFixed(6)} — ${responseTimeMs}ms`)
        return parsed
      } else {
        return await this._execute(
          'simulatePerformance',
          { title, duration, script: script.substring(0, 1000) },
          systemPrompt,
          userPrompt,
          { temperature: 0.5 }
        )
      }
    } catch (error) {
      console.error('Performance Simulation Error:', error)
      throw error
    }
  }

  async analyzeThumbnail(payload = {}) {
    if (!this.apiKey) throw new Error(`${this.providerLabel} API Key not configured`)
    const imageDataUrl = payload.imageBase64 || payload.imageDataUrl
    if (!imageDataUrl) throw new Error('analyzeThumbnail requires imageBase64')

    const store = aiLocalStorage.getStore()
    const userId = store?.userId

    // Hash the image so cache keys stay small.
    const imageHash = createHash('sha256').update(imageDataUrl).digest('hex').substring(0, 32)
    const cacheKey = makeCacheKey('analyzeThumbnail', { imageHash })

    // Cache check
    try {
      const cached = userId
        ? await AIResponseCache.findOne({ cacheKey, userId })
        : await AIResponseCache.findOne({ cacheKey })
      if (cached) {
        AIUsageLog.create({
          method: 'analyzeThumbnail',
          model: cached.usage?.model || this.premiumModel,
          promptTokens: 0, completionTokens: 0, totalTokens: 0,
          estimatedCost: 0, responseTimeMs: 0,
          success: true, cacheHit: true, userId, provider: this.providerKey, params: { imageHash }
        }).catch(() => {})

        if (userId) {
          await incrementUserUsage(userId, { spend: 0, tokens: 0, cacheHit: true })
        }

        console.log('[AI Cache HIT] analyzeThumbnail — returning cached response')
        return cached.response
      }
    } catch (cacheErr) {
      console.warn('[AI Cache] Read error:', cacheErr.message)
    }

    await this._checkBudget(userId)

    const model = this.premiumModel // gpt-4o supports vision
    const startTime = Date.now()

    const systemPrompt = `You are a YouTube thumbnail CTR expert who uses visual design principles, attention economics, and emotional psychology to predict click-through rates.
Return ONLY valid JSON with this exact structure:
{
  "ctr": <number 0-100, predicted CTR percentile vs similar-sized channels>,
  "attention": <number 0-100, focal-point clarity and visual hierarchy>,
  "clutter": <number 0-100, LOWER is better — visual noise/distractors>,
  "face": <number 0-100, face presence, emotion intensity, eye contact quality>,
  "contrast": <number 0-100, color/tonal contrast and legibility on mobile>,
  "improvements": ["specific actionable improvement 1", "...", "specific actionable improvement 3"]
}
Be rigorous and analytical. Improvements must reference specific elements visible in the image (e.g. text overlay size, face position, background noise, color clashes).`

    const userContent = [
      { type: 'text', text: 'Analyze this YouTube thumbnail and predict its CTR performance.' },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ]

    let completion
    try {
      console.log(`[AI DeepSeek] Executing analyzeThumbnail vision call using model: ${model}`)
      completion = await this._chatCompletions({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
      })
    } catch (apiErr) {
      console.error(`[AI DeepSeek] Error during vision API execution:`, apiErr)
      throw apiErr
    }

    const responseTimeMs = Date.now() - startTime
    const rawContent = completion.choices?.[0]?.message?.content || '{}'
    const usage = completion.usage || {}
    const promptTokens = usage.prompt_tokens || 0
    const completionTokens = usage.completion_tokens || 0
    const totalTokens = usage.total_tokens || promptTokens + completionTokens
    const cost = calculateCost({ provider: 'openai', model, promptTokens, completionTokens })

    const parsed = parseJSON(rawContent)
    if (!parsed || !VALIDATORS.analyzeThumbnail(parsed)) {
      AIUsageLog.create({
        method: 'analyzeThumbnail', model, promptTokens, completionTokens, totalTokens,
        estimatedCost: cost, responseTimeMs,
        success: false, error: `Invalid JSON structure from ${this.providerLabel}`,
        cacheHit: false, userId, provider: this.providerKey, params: { imageHash }
      }).catch(() => {})
      throw new Error(`${this.providerLabel} returned invalid JSON structure for analyzeThumbnail`)
    }

    // Cache + log
    const expiresAt = new Date(Date.now() + (CACHE_TTL.analyzeThumbnail || 48) * 60 * 60 * 1000)
    try {
      await AIResponseCache.findOneAndUpdate(
        userId ? { cacheKey, userId } : { cacheKey },
        {
          cacheKey, method: 'analyzeThumbnail', params: { imageHash },
          response: parsed, provider: this.providerKey,
          userId,
          usage: { promptTokens, completionTokens, totalTokens, model, estimatedCost: cost },
          responseTimeMs, expiresAt
        },
        { upsert: true, new: true }
      )
    } catch (cacheErr) {
      console.warn('[AI Cache] Write error:', cacheErr.message)
    }

    AIUsageLog.create({
      method: 'analyzeThumbnail', model, promptTokens, completionTokens, totalTokens,
      estimatedCost: cost, responseTimeMs,
      success: true, cacheHit: false, userId, provider: this.providerKey, params: { imageHash }
    }).catch(() => {})

    if (userId) {
      await incrementUserUsage(userId, { spend: cost, tokens: totalTokens, cacheHit: false })
    }

    console.log(`${this.logPrefix} analyzeThumbnail — ${model} — ${totalTokens} tokens — $${cost.toFixed(6)} — ${responseTimeMs}ms`)
    return parsed
  }

  async generateVideoIdeas(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const channel = ctx.channel || {}
    const videos = Array.isArray(ctx.videos) ? ctx.videos : []

    const topVideos = videos.slice(0, 10).map((v) => ({
      title: v.title,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      publishedAt: v.publishedAt,
    }))

    const systemPrompt = `You are a YouTube content strategist generating video concepts tuned to a specific channel's niche and historical performance.
Return ONLY valid JSON with this exact structure:
{
  "ideas": [
    {
      "id": <integer starting at 1>,
      "title": "<clickable CTR-optimized title under 70 chars>",
      "whyRecommend": "<1-2 sentence strategic rationale referencing the channel's actual content patterns>",
      "predictedViews": "<formatted like '450K' or '1.2M'>",
      "predictedEngagement": "<formatted like '32K likes'>",
      "difficulty": <number 0-100, production complexity>,
      "opportunity": <number 0-100, gap-quality × audience demand>,
      "trendScore": <number 0-100, current trend velocity>,
      "tag": "<one of exactly: 'Viral Opportunity' | 'High Potential' | 'Audience Favorite' | 'Evergreen'>",
      "badgeColor": "<one of exactly these Tailwind class strings:
         'bg-red-50 text-red-600 border-red-100' (for Viral Opportunity)
         'bg-blue-50 text-blue-600 border-blue-100' (for High Potential)
         'bg-purple-50 text-purple-600 border-purple-100' (for Audience Favorite)
         'bg-emerald-50 text-emerald-600 border-emerald-100' (for Evergreen)>"
    }
  ]
}
Generate exactly 10 ideas. Each idea must have a unique tag/badge combination aligned to the mapping above.
Predicted views/engagement should be realistic for a channel of this size.`

    const userPrompt = `Channel: ${channel.title || '(unknown)'}
Handle: ${channel.handle || '(none)'}
Niche / description: ${(channel.description || '(none provided)').substring(0, 400)}
Subscribers: ${channel.subscribers || 0}
Total videos: ${channel.totalVideos || 0}

Recent top videos:
${topVideos.length
      ? topVideos.map((v, i) => `  ${i + 1}. "${v.title}" — ${v.views || 0} views, ${v.likes || 0} likes`).join('\n')
      : '  (no video data available)'}

Generate 10 new video concepts aligned with this channel's audience and performance patterns.`

    return this._execute(
      'generateVideoIdeas',
      { channelId },
      systemPrompt,
      userPrompt,
      { temperature: 0.7 }
    )
  }

  async generateShortsIdeas(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const channel = ctx.channel || {}
    const videos = Array.isArray(ctx.videos) ? ctx.videos : []

    const topVideos = videos.slice(0, 10).map((v) => ({
      title: v.title,
      views: v.views,
    }))

    const systemPrompt = `You are a YouTube Shorts / Instagram Reels viral strategist specializing in the first 3 seconds hook, retention curves, and visual pattern interrupts.
Return ONLY valid JSON with this exact structure:
{
  "ideas": [
    {
      "id": <integer starting at 1>,
      "title": "<Short concept title under 50 chars>",
      "hook": "<0-3s spoken/text hook — must instantly create curiosity or stakes>",
      "first3s": "<precise visual action described for the first 3 seconds>",
      "cta": "<retention-driven CTA at the end of the Short>",
      "retention": "<formatted like '87%'>",
      "viralScore": <number 0-100>,
      "trendStrength": <number 0-100>
    }
  ]
}
Generate exactly 3 high-impact Shorts concepts.
Retention should be a realistic percentage between 70% and 95%.`

    const userPrompt = `Channel: ${channel.title || '(unknown)'}
Niche / description: ${(channel.description || '(none provided)').substring(0, 400)}
Subscribers: ${channel.subscribers || 0}

Recent videos for context:
${topVideos.length
      ? topVideos.map((v, i) => `  ${i + 1}. "${v.title}" — ${v.views || 0} views`).join('\n')
      : '  (no video data available)'}

Generate 3 viral Shorts concepts for this channel.`

    return this._execute(
      'generateShortsIdeas',
      { channelId },
      systemPrompt,
      userPrompt,
      { temperature: 0.8 }
    )
  }

  // ── Production-grade long-form script generation ─────────────────────
  // Builds a complete, shoot-ready YouTube script for one specific
  // recommended concept. Reuses _execute() so cache, budget, validator,
  // and usage log all apply automatically. Schema is intentionally
  // permissive — the AI decides how many sections, the total duration,
  // and which optional fields each section needs.
  async generateProductionScript(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const channel = ctx.channel || {}
    const videos = Array.isArray(ctx.videos) ? ctx.videos : []
    const recommendation = ctx.recommendation || {}

    const topVideos = videos.slice(0, 10).map((v) => ({
      title: v.title,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      publishedAt: v.publishedAt,
    }))

    const systemPrompt = `You are a senior YouTube scriptwriter and retention strategist with a track record of million-view long-form videos. You are handed a single recommended concept and the channel it belongs to, and you produce a complete, production-ready script.

Return ONLY valid JSON (no markdown fences, no commentary outside the JSON).

The shape is:
{
  "overview": "<2-3 sentence synopsis of the finished video>",
  "estimatedDuration": "<human-readable total duration, e.g. '14-18 min'>",
  "targetAudience": "<1-line description of who this is for>",
  "heroTitle": "<final CTR-optimized title under 70 chars>",
  "titles": [<3-5 alternative title ideas, each a string>],
  "thumbnailIdeas": [
    { "concept": "<visual description>", "textOverlay": "<short on-thumbnail text>", "emotion": "<the feeling it should evoke>" }
  ],
  "timeline": [
    {
      "timestamp": "<mm:ss or hh:mm:ss — you decide based on total duration>",
      "sectionName": "<e.g. Cold Open / Hook, Setup, Body 1, Payoff, CTA>",
      "narration": "<full voiceover/host text for this section, written to be read aloud>",
      "visualDirection": "<what we see on screen in this section>",
      "broll": [<array of B-roll suggestions>],
      "cameraDirection": "<shot framing / movement>",
      "motionGraphics": [<array of motion-graphic notes>],
      "onScreenText": [<array of on-screen text cues>],
      "soundEffects": [<array of SFX cues>],
      "backgroundMusic": "<music mood/track reference>",
      "editingNotes": "<cut/pacing/transition notes>",
      "retentionTrigger": "<which retention lever this section deploys — curiosity gap, pattern interrupt, open loop, stakes, etc.>"
    }
  ],
  "chapters": [{ "timestamp": "<mm:ss>", "title": "<chapter title>" }],
  "seo": {
    "keywords": [<array of SEO keywords>],
    "tags": [<array of YouTube tags>],
    "description": "<full YouTube description with timestamps>"
  },
  "cta": "<end-of-video call to action>",
  "productionNotes": [<array of practical production notes>]
}

Rules:
- The ONLY required keys on each timeline block are sectionName and narration. Every other field is OPTIONAL — include it only when it adds real value for that section. A block might have only 3 fields; another might have 10. That is correct and expected.
- Decide the total duration and the number of timeline sections (typically 5-9) based on what the script actually needs.
- Decide the timestamp format: mm:ss for videos under an hour, hh:mm:ss otherwise.
- Hook in the first 5 seconds. Build at least one open curiosity loop in the first third and resolve it near the end.
- Narration must be written as actual spoken sentences, not bullet points.
- All content must be specific to the channel and concept in the user prompt. No placeholders, no generic filler.
- Do not echo the input back. Produce the finished script.`

    const userPrompt = `CHANNEL
  Title: ${channel.title || '(unknown)'}
  Handle: ${channel.handle || '(none)'}
  Subscribers: ${channel.subscribers || 0}
  Total videos: ${channel.totalVideos || 0}
  Total views: ${channel.totalViews || 0}
  Description: ${(channel.description || '(none provided)').substring(0, 600)}

RECENT VIDEOS (top ${topVideos.length} by recency)
${topVideos.length
      ? topVideos.map((v, i) => `  ${i + 1}. "${v.title || '(untitled)'}" — ${v.views || 0} views, ${v.likes || 0} likes, ${v.comments || 0} comments`).join('\n')
      : '  (no video data available)'}

RECOMMENDED CONCEPT — write the full script for this one
  id: ${recommendation.id ?? '(none)'}
  title: ${recommendation.title || '(none)'}
  whyRecommended: ${recommendation.whyRecommend || '(none provided)'}
  predictedViews: ${recommendation.predictedViews || 'n/a'}
  predictedEngagement: ${recommendation.predictedEngagement || 'n/a'}
  opportunityScore: ${recommendation.opportunity ?? 'n/a'} / 100
  trendScore: ${recommendation.trendScore ?? 'n/a'} / 100
  productionDifficulty: ${recommendation.difficulty ?? 'n/a'} / 100
  tag: ${recommendation.tag || '(none)'}

Write the complete production script now.`

    // When the controller asks for regeneration, include a per-call nonce in
    // the cache params. _execute's AIResponseCache hashes params to compute
    // its key — without the nonce, regen would silently return the previous
    // cached response instead of calling OpenAI again.
    const cacheParams = {
      channelId,
      ideaId: recommendation.id,
      // Include title in the cache params so each recommendation gets its own
      // cache slot — without it, all ideas for a channel would collide.
      ideaTitle: recommendation.title,
    }
    if (ctx.regenerate) {
      cacheParams.regenAt = ctx.regenAt || Date.now()
    }

    const promptApproxTokens = Math.round((systemPrompt.length + userPrompt.length) / 4)
    console.log('[ProductionScript] OpenAI request about to fire', {
      channelId,
      ideaId: recommendation.id,
      model: this._getModel('generateProductionScript'),
      temperature: 0.85,
      promptChars: systemPrompt.length + userPrompt.length,
      promptApproxTokens,
    })

    try {
      const result = await this._execute(
        'generateProductionScript',
        cacheParams,
        systemPrompt,
        userPrompt,
        { temperature: 0.85 }
      )
      console.log('[ProductionScript] OpenAI response validated', {
        channelId,
        ideaId: recommendation.id,
        timelineSections: Array.isArray(result?.timeline) ? result.timeline.length : 0,
        hasOverview: Boolean(result?.overview),
      })
      return result
    } catch (err) {
      // _execute already logged structured detail, but add a final clearly
      // labeled marker so the failure is impossible to miss in dev logs.
      console.error('[ProductionScript] OpenAI call FAILED', {
        channelId,
        ideaId: recommendation.id,
        errorName: err?.name,
        errorMessage: err?.message,
      })
      throw err
    }
  }

  async getStrategistTips(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const channel = ctx.channel || {}
    const videos = Array.isArray(ctx.videos) ? ctx.videos : []

    // Compute a few basic signals from real data so tips feel grounded.
    const totalViews = (channel.totalViews || 0)
    const totalVideos = (channel.totalVideos || 0)
    const avgViewsPerVideo = totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0
    const recentUploads = videos.length
    const lastVideoDate = videos[0]?.publishedAt || null

    const systemPrompt = `You are a YouTube growth strategist advising a creator in real time.
Return ONLY valid JSON with this exact structure:
{
  "tips": [
    {
      "id": <integer starting at 1>,
      "type": "<one of exactly: 'positive' | 'warning' | 'info'>",
      "text": "<one concrete, specific, actionable sentence — under 200 chars>"
    }
  ]
}
Generate exactly 5 tips. Mix of types — at least 1 positive, 1 warning, 1 info.
Each tip must reference real signals (subscriber count, upload cadence, average views, niche, recent video performance) and give a specific next action — not generic platitudes.`

    const userPrompt = `Channel: ${channel.title || '(unknown)'}
Niche: ${(channel.description || '(none)').substring(0, 300)}
Subscribers: ${channel.subscribers || 0}
Total views: ${totalViews}
Total videos: ${totalVideos}
Average views per video: ${avgViewsPerVideo}
Recent uploads tracked: ${recentUploads}
Last upload: ${lastVideoDate ? new Date(lastVideoDate).toISOString() : '(none)'}

Generate 5 prioritized strategist tips grounded in this data.`

    return this._execute(
      'getStrategistTips',
      { channelId },
      systemPrompt,
      userPrompt,
      { temperature: 0.6 }
    )
  }

  async summarizeAlerts(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const channel = ctx.channel || {}
    const videos = Array.isArray(ctx.videos) ? ctx.videos : []
    const derivedAlerts = Array.isArray(ctx.derivedAlerts) ? ctx.derivedAlerts : []
    const snapshot = ctx.analyticsSnapshot || {}

    const totalViews = Number(channel.totalViews || 0)
    const totalVideos = Number(channel.totalVideos || 0)
    const avgViewsPerVideo = totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0

    const systemPrompt = `You are a YouTube analytics advisor summarizing risks and opportunities for a creator.
Return ONLY valid JSON with this exact structure:
{
  "summary": "<2-3 sentence executive briefing grounded in the derived alerts and analytics>",
  "topRisks": [
    { "title": "<short label>", "desc": "<one concrete sentence with the implication and next action>", "severity": "<one of: 'high' | 'medium' | 'low'>" }
  ],
  "topOpportunities": [
    { "title": "<short label>", "desc": "<one concrete sentence with the upside and how to capture it>", "severity": "<one of: 'high' | 'medium' | 'low'>" }
  ]
}
Produce 2-3 risks and 2-3 opportunities. Each must reference real signals from the inputs — never invent metrics.`

    const userPrompt = `Channel: ${channel.title || '(unknown)'}
Subscribers: ${channel.subscribers || 0}
Total views: ${totalViews}
Total videos: ${totalVideos}
Average views per video: ${avgViewsPerVideo}
Engagement rate: ${snapshot.engagementRate ?? '(unknown)'}%
Views growth: ${snapshot.viewsGrowth ?? '(unknown)'}%

Recent uploads (top 5):
${videos.slice(0, 5).map((v) => `- ${(v.title || '').slice(0, 80)} — ${Number(v.views || 0).toLocaleString()} views`).join('\n') || '(none tracked)'}

Derived alerts already computed from analytics:
${derivedAlerts.map((a) => `- [${a.severity || 'info'}] ${a.title}: ${a.desc}`).join('\n') || '(none)'}

Summarize the top risks and opportunities for this channel.`

    return this._execute(
      'summarizeAlerts',
      { channelId, derivedCount: derivedAlerts.length },
      systemPrompt,
      userPrompt,
      { temperature: 0.5 }
    )
  }

  async getContentGaps(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const channel = ctx.channel || {}
    const videos = Array.isArray(ctx.videos) ? ctx.videos : []

    const topVideos = videos.slice(0, 10).map((v) => ({
      title: v.title,
      views: v.views,
    }))

    const systemPrompt = `You are a YouTube content gap analyst specializing in niche opportunity discovery. You analyze a channel's existing content against search demand, competitor coverage, and trending topics to find high-value content gaps.
Return ONLY valid JSON with this exact structure:
{
  "gaps": [
    {
      "id": <integer starting at 1>,
      "topic": "<specific content gap topic — a concrete video title or keyword cluster>",
      "opportunity": "<one of exactly: 'Very High' | 'High' | 'Medium'>",
      "monthlyVolume": "<formatted like '850K searches' or '1.2M searches'>",
      "difficulty": "<one of exactly: 'Low' | 'Medium' | 'High'>",
      "badgeColor": "<one of exactly these Tailwind class strings:
         'bg-red-50 text-red-600 border-red-100' (for Very High)
         'bg-blue-50 text-blue-600 border-blue-100' (for High)
         'bg-purple-50 text-purple-600 border-purple-100' (for Medium)>"
    }
  ],
  "nicheTrends": [
    {
      "name": "<trending topic cluster name>",
      "growth": "<formatted like '+340% in 90 days'>",
      "demand": "<one of: 'Very High' | 'High' | 'Rising'>"
    }
  ]
}
Generate exactly 5 gaps and 4 niche trends.
Each gap must reference topics the channel has NOT covered but that have high search demand in their niche.
Niche trends must be specific to the channel's content category.`

    const userPrompt = `Channel: ${channel.title || '(unknown)'}
Niche / description: ${(channel.description || '(none provided)').substring(0, 400)}
Subscribers: ${channel.subscribers || 0}
Total videos: ${channel.totalVideos || 0}

Recent videos for context:
${topVideos.length
      ? topVideos.map((v, i) => `  ${i + 1}. "${v.title}" — ${v.views || 0} views`).join('\n')
      : '  (no video data available)'}

Identify 5 content gaps and 4 niche trends for this channel.`

    return this._execute(
      'getContentGaps',
      { channelId },
      systemPrompt,
      userPrompt,
      { temperature: 0.7 }
    )
  }

  // ── Portfolio Intelligence (multi-channel aggregates) ────────────────

  async getPortfolioSummary(ctx = {}, opts = {}) {
    const portfolioCtx = buildPortfolioContext(ctx.channels)
    if (portfolioCtx.channels.length === 0) {
      return { channelsCount: 0, channels: [] }
    }
    try {
      const systemPrompt = `You are a portfolio summarizer. Generate a concise executive summary of a multi-channel YouTube portfolio. Return ONLY valid JSON:
{
  "channelsCount": <number>,
  "channels": [{
    "id": <string>,
    "name": <string>,
    "subscribers": <number>,
    "totalViews": <number>,
    "totalVideos": <number>,
    "healthLabel": "Excellent"|"Good"|"Average"|"Needs Attention",
    "primaryStrength": <string>,
    "growthSignal": <string>
  }],
  "portfolioStats": {
    "totalSubscribers": <number>,
    "totalViews": <number>,
    "totalVideos": <number>,
    "avgEngagementRate": <number>,
    "diversificationScore": <number 0-100>
  }
}`
      const userPrompt = `Summarize this YouTube portfolio:\n\n${JSON.stringify(portfolioCtx, null, 2)}`
      const params = { channelIds: portfolioCtx.channels.map(c => c.channelId).sort() }
      return await this._execute('getPortfolioSummary', params, systemPrompt, userPrompt)
    } catch (err) {
      console.warn('[AI DeepSeek] getPortfolioSummary call failed, using fallback:', err.message)
      return getPortfolioSummaryFallback(portfolioCtx)
    }
  }

  async getAudienceOverlap(ctx = {}, opts = {}) {
    const portfolioCtx = buildPortfolioContext(ctx.channels)
    if (portfolioCtx.channels.length < 2) {
      return { pairs: [], radarData: [] }
    }
    try {
      const systemPrompt = `You are an audience overlap analyst. Estimate pairwise audience overlap, content similarity, demographic match, and collaboration potential between channels in a portfolio. Return ONLY valid JSON:
{
  "pairs": [{
    "channelAId": <string>,
    "channelAName": <string>,
    "channelBId": <string>,
    "channelBName": <string>,
    "overlap": <number 0-100>,
    "contentSim": <number 0-100>,
    "demoMatch": <number 0-100>,
    "collabPotential": <number 0-100>,
    "rating": "Outstanding Synergy"|"Strong Potential"|"Moderate Fit"|"Low Synergy",
    "ratingColor": <tailwind classes>,
    "recText": <string>
  }],
  "radarData": [{ "subject": <axis>, "<ChannelName>": <number 0-100>, ... }]
}
Rules:
- Generate one pair per unique channel combination.
- radarData axes: "Tech Appeal", "Entertainment Value", "Educational Depth", "Viral Potential", "Subscriber Loyalty", "Global Reach".
- rating/ratingColor must align with collabPotential: >=80 outstanding (emerald), >=60 strong (blue), >=40 moderate (amber), <40 low (gray).`
      const userPrompt = `Analyze audience overlap for these channels:\n\n${JSON.stringify(portfolioCtx.channels, null, 2)}`
      const params = { channelIds: portfolioCtx.channels.map(c => c.channelId).sort() }
      return await this._execute('getAudienceOverlap', params, systemPrompt, userPrompt)
    } catch (err) {
      console.warn('[AI DeepSeek] getAudienceOverlap call failed, using fallback:', err.message)
      return getAudienceOverlapFallback(portfolioCtx)
    }
  }

  async getCrossPromotion(ctx = {}, opts = {}) {
    const portfolioCtx = buildPortfolioContext(ctx.channels)
    if (portfolioCtx.channels.length < 2) {
      return { promotions: [] }
    }
    try {
      const systemPrompt = `You are a cross-promotion strategist. Identify high-impact cross-promotion opportunities between channels in a portfolio. Return ONLY valid JSON:
{
  "promotions": [{
    "channelAId": <string>,
    "channelAName": <string>,
    "channelBId": <string>,
    "channelBName": <string>,
    "opportunity": <string>,
    "format": "Shoutout"|"Collab Video"|"Shorts Takeover"|"Community Post"|"Livestream",
    "estimatedLift": "+X%",
    "effort": "Low"|"Medium"|"High",
    "priority": "Critical"|"High"|"Medium"|"Low"
  }]
}
Generate 2-5 promotions. Each should be a concrete actionable idea, not generic advice.`
      const userPrompt = `Recommend cross-promotions for this portfolio:\n\n${JSON.stringify(portfolioCtx.channels, null, 2)}`
      const params = { channelIds: portfolioCtx.channels.map(c => c.channelId).sort() }
      return await this._execute('getCrossPromotion', params, systemPrompt, userPrompt)
    } catch (err) {
      console.warn('[AI DeepSeek] getCrossPromotion call failed, using fallback:', err.message)
      return getCrossPromotionFallback(portfolioCtx)
    }
  }

  async getPortfolioContentGaps(ctx = {}, opts = {}) {
    const portfolioCtx = buildPortfolioContext(ctx.channels)
    if (portfolioCtx.channels.length === 0) {
      return { gaps: [] }
    }
    try {
      const systemPrompt = `You are a content gap analyst. Identify topics that competitors are exploiting but this channel portfolio is NOT covering. Return ONLY valid JSON:
{
  "gaps": [{
    "topic": <string>,
    "category": <string>,
    "volume": "<search volume like '140K'>",
    "growth": "+X%",
    "difficulty": "Easy"|"Medium"|"Hard",
    "interest": <number 0-100>,
    "format": "Long Form"|"Shorts",
    "viewRange": "<like '1.2M - 2.4M'>",
    "ctr": "+X%",
    "opportunityScore": <number 0-100>,
    "compLevel": "Low"|"Medium"|"High",
    "diffScore": <number 0-100>,
    "bestChannelId": <string from input>,
    "bestChannelName": <string from input>,
    "confidence": <number>,
    "roiScore": <number>,
    "sparkData": [{ "v": <number> }, ...8 points...],
    "reasons": {
      "audience": <string>,
      "search": <string>,
      "competitor": <string>,
      "portfolio": <string>
    }
  }]
}
Generate 4-6 gap opportunities aligned with the portfolio's existing niches.`
      const userPrompt = `Find content gaps for this portfolio:\n\n${JSON.stringify(portfolioCtx, null, 2)}`
      const params = { channelIds: portfolioCtx.channels.map(c => c.channelId).sort() }
      return await this._execute('getPortfolioContentGaps', params, systemPrompt, userPrompt)
    } catch (err) {
      console.warn('[AI DeepSeek] getPortfolioContentGaps call failed, using fallback:', err.message)
      return getPortfolioContentGapsFallback(portfolioCtx)
    }
  }

  async getCannibalization(ctx = {}, opts = {}) {
    const portfolioCtx = buildPortfolioContext(ctx.channels)
    if (portfolioCtx.channels.length < 2) {
      return { warnings: [] }
    }
    try {
      const systemPrompt = `You are a content cannibalization analyst. Detect channels in the portfolio that compete for the same audience intent, search keywords, or content niche — cannibalizing each other's growth. Return ONLY valid JSON:
{
  "warnings": [{
    "channelAId": <string>,
    "channelAName": <string>,
    "channelBId": <string>,
    "channelBName": <string>,
    "overlapTopic": <string>,
    "cannibalizationScore": <number 0-100>,
    "severity": "Critical"|"High"|"Medium"|"Low",
    "recommendation": <string>
  }]
}
If no significant cannibalization, return empty warnings array.`
      const userPrompt = `Detect cannibalization in this portfolio:\n\n${JSON.stringify(portfolioCtx.channels, null, 2)}`
      const params = { channelIds: portfolioCtx.channels.map(c => c.channelId).sort() }
      return await this._execute('getCannibalization', params, systemPrompt, userPrompt)
    } catch (err) {
      console.warn('[AI DeepSeek] getCannibalization call failed, using fallback:', err.message)
      return getCannibalizationFallback(portfolioCtx)
    }
  }

  async getPortfolioStrategist(ctx = {}, opts = {}) {
    const portfolioCtx = buildPortfolioContext(ctx.channels)
    if (portfolioCtx.channels.length === 0) {
      return {
        healthScore: 0, stabilityScore: 0, riskLevel: 'Low',
        riskBadgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-100/50',
        growthMomentum: '+0%', bestPerformingCh: null, fastestGrowingCh: null,
        highestEngagementCh: null, highestRevenueCh: null, mostConsistentCh: null,
        subConcentration: 0, viewConcentration: 0, revenueDependency: 0,
        audienceDiversification: 0, recommendations: [], actionCenter: [], growthRadar: [],
      }
    }
    try {
      const systemPrompt = `You are a Chief Strategy Officer for a multi-channel YouTube portfolio. Analyze portfolio health, concentration risk, and growth momentum. Return ONLY valid JSON with this exact structure:
{
  "healthScore": <number 0-100>,
  "stabilityScore": <number 0-100>,
  "riskLevel": "Low" | "Moderate" | "High",
  "riskBadgeColor": "text-emerald-600 bg-emerald-50 border-emerald-100/50" | "text-amber-500 bg-amber-50 border-amber-100/50" | "text-red-500 bg-red-50 border-red-100/50",
  "growthMomentum": "+X%" or "-X%",
  "bestPerformingCh": { "id": <string>, "name": <string>, "color": "#8B5CF6" },
  "fastestGrowingCh": { "id": <string>, "name": <string>, "color": "#3B82F6" },
  "highestEngagementCh": { "id": <string>, "name": <string>, "color": "#10B981" },
  "highestRevenueCh": { "id": <string>, "name": <string>, "color": "#F59E0B" },
  "mostConsistentCh": { "id": <string>, "name": <string>, "color": "#8B5CF6" },
  "subConcentration": <number 0-100>,
  "viewConcentration": <number 0-100>,
  "revenueDependency": <number 0-100>,
  "audienceDiversification": <number 0-100>,
  "recommendations": [{ "priority": "Critical"|"High Priority"|"Medium Priority"|"Opportunity", "priorityColor": <tailwind classes>, "title": <string>, "desc": <string>, "actionText": <string>, "confidence": <number>, "impact": <string>, "executionTime": <string>, "impactScore": <number>, "channelColor": <hex> }],
  "actionCenter": [{ "action": <string>, "gain": <string>, "impact": "High"|"Medium"|"Low", "difficulty": "Easy"|"Medium"|"Hard" }],
  "growthRadar": [{ "topic": <string>, "score": <number>, "growth": "+X%", "comp": "Low"|"Medium"|"High" }]
}
Rules:
- healthScore reflects overall portfolio vitality (0-100).
- subConcentration = largest channel's subscriber share as % of total.
- Pick real channel IDs from the input for each "bestPerformingCh" etc.
- 2-4 recommendations, sorted by impactScore desc.
- 3-5 actionCenter items, 3-5 growthRadar items.`
      const userPrompt = `Analyze this YouTube portfolio:\n\n${JSON.stringify(portfolioCtx, null, 2)}`
      const params = { channelIds: portfolioCtx.channels.map(c => c.channelId).sort() }
      return await this._execute('getPortfolioStrategist', params, systemPrompt, userPrompt, { temperature: 0.4 })
    } catch (err) {
      console.warn('[AI DeepSeek] getPortfolioStrategist call failed, using fallback:', err.message)
      return getPortfolioStrategistFallback(portfolioCtx)
    }
  }

  async generateCompetitorOpportunities(payload = {}, _opts = {}) {
    const channel = payload.channel || {}
    const competitors = Array.isArray(payload.competitors) ? payload.competitors : []
    const topVideos = Array.isArray(payload.topVideos) ? payload.topVideos : []

    const systemPrompt = `You are a YouTube growth strategist and competitive intelligence analyst.
Analyze the target channel context, the competitor channels in the workspace, and the top performing competitor videos to discover content opportunities that the target channel can exploit.
Return ONLY valid JSON matching this exact structure:
{
  "opportunities": [
    {
      "title": "<compelling, search-optimized/click-optimized video title option>",
      "opportunityLevel": "High" | "Medium" | "Very High",
      "estimatedSearchVolume": "<estimated volume range, e.g., '10K - 50K' or '100K+'>",
      "reason": "<detailed strategic reasoning explaining why this is an opportunity based on competitor gaps, high view counts, low keyword optimization, or specific audience demand>"
    }
  ]
}
Rubric:
- Compare the target channel niche/profile to competitors.
- Look for themes/topics in the top competitor videos that get high engagement/views but could be improved (e.g. better packaging, different angle, more depth).
- Keep suggestions extremely actionable, specific, and realistic for the channel niche.`

    const userPrompt = `Analyze competitive landscape for target channel:
Target Channel: "${channel.title || 'Unknown'}" (Subscribers: ${channel.subscribers || 0}, Description: "${channel.description || ''}")
Competitors: ${JSON.stringify(competitors.map(c => ({ title: c.title, handle: c.handle, subscribers: c.subscribers, description: c.description })))}
Top Competitor Videos: ${JSON.stringify(topVideos.map(v => ({ title: v.title, views: v.views, duration: v.duration, publishedAt: v.publishedAt })))}`

    return await this._execute(
      'generateCompetitorOpportunities',
      { channelId: payload.channelId || 'unknown' },
      systemPrompt,
      userPrompt,
      { temperature: 0.7 }
    )
  }

  // ── Script Workspace 2.0 ────────────────────────────────────────────
  // Analyzes a creator's historical videos + channel description and builds
  // a Creator Style Profile. The profile is the input to generateStyledScript
  // and scoreScriptStyle — it's what makes the output sound like the creator
  // rather than generic AI prose.
  //
  // v1 limitation: Video model has no transcript field, so this works from
  // titles + channel description + thumbnail URLs only. Hook style, rhythm,
  // and vocabulary scores are inferred from title patterns and description
  // tone. Once transcripts are added to Video, this method should be updated
  // to use them — quality will jump substantially.
  async analyzeCreatorStyle(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const channel = ctx.channel || {}
    const videos = Array.isArray(ctx.videos) ? ctx.videos : []

    const topVideos = videos.slice(0, 15).map((v) => ({
      title: v.title,
      views: v.views,
      likes: v.likes,
      thumbnail: v.thumbnail || null,
      publishedAt: v.publishedAt,
    }))

    const systemPrompt = `You are a content strategist who reverse-engineers creators' unique voices. Given a channel's recent video titles, view counts, and channel description, you produce a Creator Style Profile — a structured description of how this creator writes and packages content. The profile is used downstream to generate new scripts that sound like the creator actually wrote them.

Return ONLY valid JSON (no markdown fences). Shape:
{
  "summary": "<2-3 sentence plain-English description of this creator's voice and packaging style>",
  "languageMix": { "english": <0-1>, "hindi": <0-1>, "other": <0-1> },
  "avgTitleLengthChars": <number>,
  "titleStyle": "<one of: curiosity-question | bold-claim | listicle | story-teaser | how-to | controversy | numeric-claim>",
  "energyLevel": <0-1>,
  "humorLevel": <0-1>,
  "vocabulary": {
    "formality": <0-1, 0=casual 1=formal>,
    "technicality": <0-1>,
    "signatureWords": [<5-10 words/phrases this creator repeats>]
  },
  "hookStyle": "<one of: curiosity-question | bold-claim | story-cold-open | stat-shock | pattern-interrupt | contrarian-take>",
  "ctaStyle": "<one of: soft-invite | direct-ask | community-build | reward-promise | curiosity-loop>",
  "retentionTechniques": [<3-6 techniques this creator likely uses>],
  "thumbnailStyle": {
    "density": "<sparse | medium | dense>",
    "primaryColor": "<hex or named color guess>",
    "textStyle": "<minimal | bold-overlay | heavy-text>",
    "faceStyle": "<none | expressive-closeup | small-inset>"
  },
  "writingTone": "<one of: authoritative | conversational | hype | educational | inspirational | analytical>",
  "estimatedAudience": "<1-line description>"
}

Rules:
- Every 0-1 score must be a number, not a string.
- "signatureWords" must come from the actual titles where possible; fall back to description only if titles are absent.
- Do not invent facts. If titles are absent or sparse, mark the corresponding field null or "unknown" rather than guessing.
- The thumbnailStyle field is a best-effort guess from titles — it's refined separately by analyzing actual thumbnail images later.`

    const userPrompt = `CHANNEL
  Title: ${channel.title || '(unknown)'}
  Handle: ${channel.handle || '(none)'}
  Description: ${(channel.description || '(none provided)').substring(0, 800)}
  Subscribers: ${channel.subscribers || 0}
  Total videos: ${channel.totalVideos || 0}

RECENT VIDEOS (top ${topVideos.length})
${topVideos.length
      ? topVideos.map((v, i) => `  ${i + 1}. "${v.title || '(untitled)'}" — ${v.views || 0} views, ${v.likes || 0} likes`).join('\n')
      : '  (no video data available)'}

Build the Creator Style Profile now.`

    return this._execute(
      'analyzeCreatorStyle',
      { channelId },
      systemPrompt,
      userPrompt,
      { temperature: 0.5 },
    )
  }

  // Generates a complete script for a recommended concept, but shaped to
  // imitate the creator's voice per the provided style profile. The output
  // schema is the Script Workspace editor shape (title/hook/fullScript/cta/
  // description/hashtags) plus a styleMatch score object — not the legacy
  // timeline-based production-script shape.
  //
  // The `mode` parameter controls creative latitude:
  //   - 'similar'   → stay close to the creator's established patterns
  //   - 'creative'  → mild creative deviation
  //   - 'new'       → fully fresh take, still in the creator's voice
  async generateStyledScript(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const channel = ctx.channel || {}
    const videos = Array.isArray(ctx.videos) ? ctx.videos : []
    const recommendation = ctx.recommendation || {}
    const creatorStyle = ctx.creatorStyle || {}
    const mode = ['similar', 'creative', 'new'].includes(ctx.mode) ? ctx.mode : 'similar'

    const topVideos = videos.slice(0, 8).map((v) => ({
      title: v.title,
      views: v.views,
    }))

    const systemPrompt = `You are a ghostwriter who writes video scripts that sound like the creator actually wrote them. You are given:
1. A Creator Style Profile (the target voice)
2. A channel's metadata and recent video titles
3. One specific recommended concept to write a script for

Your job: produce a complete, production-ready script in the creator's voice — not generic AI prose.

Return ONLY valid JSON (no markdown fences). Shape:
{
  "title": "<final CTR-optimized title under 70 chars, in the creator's title style>",
  "hook": "<0-10 second hook — first words spoken, written in the creator's hook style>",
  "fullScript": "<the complete spoken script as one continuous string. Use \\n\\n for paragraph breaks. Write as actual spoken sentences, not bullets. Minimum 400 words. Imitate the creator's sentence rhythm, vocabulary, and tone.>",
  "cta": "<end-of-video call to action, in the creator's CTA style>",
  "description": "<YouTube description in the creator's voice, 100-300 words, with a 1-line hook then 2-3 sentences of context>",
  "hashtags": [<8-15 relevant hashtags as strings, no # prefix>],
  "styleMatch": {
    "overall": <number 0-100>,
    "language": <number 0-100>,
    "hook": <number 0-100>,
    "flow": <number 0-100>,
    "rhythm": <number 0-100>,
    "vocabulary": <number 0-100>,
    "retention": <number 0-100>
  }
}

Rules:
- styleMatch scores MUST be numbers 0-100. Score honestly: if the script genuinely imitates the creator, scores should be 80+; if some dimension is off, score it lower.
- The hook MUST deploy one of the techniques in creatorStyle.retentionTechniques.
- Use creatorStyle.vocabulary.signatureWords naturally throughout the script where they fit — do not force them.
- Match creatorStyle.languageMix: if hindi > 0.2, sprinkle natural Hinglish where the creator would.
- ${mode === 'similar' ? 'STAY CLOSE to the creator\'s established patterns — minimal creative deviation.' : mode === 'creative' ? 'MILD creative deviation — try a fresh angle, but keep the voice intact.' : 'FULLY fresh take — surprise the audience, but the voice must still feel like the creator.'}
- All content specific to the recommended concept. No placeholders, no filler.`

    const userPrompt = `CREATOR STYLE PROFILE
${JSON.stringify(creatorStyle, null, 2)}

CHANNEL
  Title: ${channel.title || '(unknown)'}
  Description: ${(channel.description || '(none provided)').substring(0, 400)}

RECENT VIDEOS (for reference, top ${topVideos.length})
${topVideos.length
      ? topVideos.map((v, i) => `  ${i + 1}. "${v.title}" — ${v.views || 0} views`).join('\n')
      : '  (none)'}

RECOMMENDED CONCEPT — write the script for this one
  title: ${recommendation.title || '(none)'}
  whyRecommended: ${recommendation.whyRecommend || '(none)'}
  predictedViews: ${recommendation.predictedViews || 'n/a'}
  opportunityScore: ${recommendation.opportunity ?? 'n/a'} / 100

MODE: ${mode}

Write the script now — imitate the creator's voice, don't write generic AI prose.`

    const cacheParams = {
      channelId,
      ideaId: recommendation.id,
      ideaTitle: recommendation.title,
      mode,
    }
    if (ctx.regenerate) {
      cacheParams.regenAt = ctx.regenAt || Date.now()
    }

    return this._execute(
      'generateStyledScript',
      cacheParams,
      systemPrompt,
      userPrompt,
      { temperature: mode === 'new' ? 0.95 : mode === 'creative' ? 0.9 : 0.8 },
    )
  }

  // Applies a transformation to an existing script. Used by the editor
  // toolbar buttons: Rewrite / Shorter / Longer / More Viral / More
  // Emotional / More Educational / More Storytelling. Returns the same
  // script shape with the affected fields rewritten.
  async rewriteScript(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const script = ctx.script || {}
    const action = ctx.action || 'rewrite'
    const creatorStyle = ctx.creatorStyle || {}

    const actionPrompts = {
      'rewrite':       'Rewrite the script to be cleaner and tighter without changing length or meaning.',
      'shorter':       'Cut the script to roughly 60% of its current length. Keep every key idea. Tighten phrasing.',
      'longer':        'Expand the script to roughly 150% of its current length. Add depth, examples, and elaboration — never filler.',
      'viral':         'Rewrite for maximum virality: stronger hook, more pattern interrupts, higher curiosity density, more shocking framing.',
      'emotional':     'Rewrite to heighten emotion: more vulnerability, sensory language, story beats, audience empathy.',
      'educational':   'Rewrite to be more educational: clearer explanations, more concrete examples, better scaffolding, explicit takeaways.',
      'storytelling':  'Rewrite as a narrative: stronger story arc, characters, tension and release, sensory scenes.',
    }
    const actionInstruction = actionPrompts[action] || actionPrompts.rewrite

    const systemPrompt = `You are a script editor. You receive an existing script and a transformation instruction, and you return the rewritten script. You preserve the creator's voice and the script's structure (title/hook/fullScript/cta/description/hashtags).

Return ONLY valid JSON (no markdown fences). Shape:
{
  "title": "<rewritten title>",
  "hook": "<rewritten hook>",
  "fullScript": "<rewritten full script>",
  "cta": "<rewritten CTA>",
  "description": "<rewritten description>",
  "hashtags": [<rewritten hashtags>]
}

Rules:
- Preserve the creator's voice as captured in the provided Creator Style Profile.
- Only the fields affected by the transformation should change materially; others may stay the same.
- Never invent new topics — stay within the original concept.
- fullScript must be a non-empty string with \\n\\n paragraph breaks.`

    const userPrompt = `ACTION: ${action}
INSTRUCTION: ${actionInstruction}

CREATOR STYLE PROFILE (preserve this voice)
${JSON.stringify(creatorStyle, null, 2)}

CURRENT SCRIPT
  title: ${script.title || ''}
  hook: ${script.hook || ''}
  fullScript: ${script.fullScript || ''}
  cta: ${script.cta || ''}
  description: ${script.description || ''}
  hashtags: ${JSON.stringify(script.hashtags || [])}

Apply the transformation now.`

    return this._execute(
      'rewriteScript',
      { channelId, action, scriptHash: `${(script.fullScript || '').length}:${(script.fullScript || '').slice(0, 200).replace(/\s+/g, '')}` },
      systemPrompt,
      userPrompt,
      { temperature: 0.75 },
    )
  }

  // Scores how closely a given script matches the creator's style profile.
  // Used by the editor to show a live Style Match panel and by generateStyledScript
  // to validate its own output.
  async scoreScriptStyle(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const script = ctx.script || {}
    const creatorStyle = ctx.creatorStyle || {}

    const systemPrompt = `You are a strict editor scoring how well a script imitates a specific creator's voice. Be honest — do not default to high scores.

Return ONLY valid JSON. Shape:
{
  "styleMatch": {
    "overall": <number 0-100>,
    "language": <number 0-100, how well the language mix matches>,
    "hook": <number 0-100, hook technique alignment>,
    "flow": <number 0-100, conversation flow>,
    "rhythm": <number 0-100, sentence length and pacing>,
    "vocabulary": <number 0-100, signature word usage and formality>,
    "retention": <number 0-100, retention technique usage>
  }
}

Score each dimension independently. overall should be a weighted average leaning on the dimensions most relevant to the creator's voice (hook, rhythm, vocabulary).`

    const userPrompt = `CREATOR STYLE PROFILE
${JSON.stringify(creatorStyle, null, 2)}

SCRIPT TO SCORE
  title: ${script.title || ''}
  hook: ${script.hook || ''}
  fullScript: ${(script.fullScript || '').substring(0, 3000)}
  cta: ${script.cta || ''}

Score it honestly now.`

    return this._execute(
      'scoreScriptStyle',
      { channelId, scriptHash: `${(script.fullScript || '').length}:${(script.fullScript || '').slice(0, 200).replace(/\s+/g, '')}` },
      systemPrompt,
      userPrompt,
      { temperature: 0.3 },
    )
  }

  // ── Research Workspace (Phase 2) ───────────────────────────────────────
  // Step 1 of 2: extract every factual claim, statistic, and date from the
  // script. Returns an array of claim objects — no verdicts yet (verdicts
  // require the search-results pass). Cache key is keyed on a hash of the
  // script content so identical scripts short-circuit.
  async extractScriptClaims(ctx = {}, _opts = {}) {
    const script = ctx.script || {}
    const scriptBody = script.fullScript || ''

    const systemPrompt = `You are a meticulous fact-checker. Read the script and extract every factual claim that could be verified or falsified against external sources.

Return ONLY valid JSON (no markdown fences). Shape:
{
  "claims": [
    {
      "id": "<short stable id like 'claim-1'>",
      "text": "<the exact claim as a single sentence>",
      "type": "<statistic | fact | date | claim>",
      "snippet": "<the verbatim 3-12 word phrase from the script where the claim appears>",
      "field": "<title | hook | fullScript | cta | description>"
    }
  ]
}

Rules:
- "statistic" = a numeric figure or percentage (e.g. "73% of users").
- "date"     = a specific date, year, or time reference (e.g. "in 2024").
- "fact"     = a checkable assertion about the world (e.g. "OpenAI is based in SF").
- "claim"    = a subjective or hard-to-verify assertion.
- Include every distinct factual statement. Don't merge multiple stats into one claim.
- "snippet" MUST be a literal substring of the script (used downstream for the Apply patch).
- Skip pure opinions, calls to action, and creative phrasing without factual content.
- If the script has no factual claims, return { "claims": [] }.`

    const userPrompt = `SCRIPT
  title:       ${script.title || ''}
  hook:        ${script.hook || ''}
  fullScript:  ${scriptBody}
  cta:         ${script.cta || ''}
  description: ${script.description || ''}

Extract the claims now.`

    const scriptHashInput = `${script.title || ''}::${(scriptBody).slice(0, 1200)}::${(scriptBody).length}`

    const result = await this._execute(
      'extractScriptClaims',
      { scriptHash: scriptHashInput },
      systemPrompt,
      userPrompt,
      { temperature: 0.2 },
    )

    // Normalize: _execute returns the { claims: [...] } object; pass the array
    // through so downstream code can iterate directly.
    return Array.isArray(result?.claims) ? result.claims : []
  }

  // Step 2 of 2: combine the claims with (possibly empty) search results to
  // produce verdicts, structured suggestions, missing-context, and a
  // researchScore. When searchResults is empty (stub mode), the AI is told to
  // mark verdicts 'unverified' with low confidence — not to invent sources.
  async analyzeScriptResearch(ctx = {}, _opts = {}) {
    const script = ctx.script || {}
    const claims = Array.isArray(ctx.claims) ? ctx.claims : []
    // searchResults: Map<claimText, [{url, title, snippet, publishedDate}]>
    // Convert to a plain object for the prompt.
    const searchResultsMap = ctx.searchResults instanceof Map
      ? ctx.searchResults
      : new Map(Object.entries(ctx.searchResults || {}))

    const grounded = ctx.grounded !== false // default true; engine sets false in stub mode
    const groundingInstruction = grounded
      ? `GROUNDING: Live web search results are provided for each claim below. Use them to mark verdicts:
   - "verified"         = the source clearly supports the claim
   - "needs-citation"   = claim is plausible but the source is indirect or weak
   - "weak"             = sources partially contradict or only tangentially relate
   - "false"            = sources clearly contradict the claim
   - "unverified"       = no relevant source found`
      : `GROUNDING: Live web search is NOT configured (stub mode). Mark every verdict as "unverified" with confidence < 25. Do NOT invent sources, URLs, or dates — every entry in claim.sources MUST be empty when no search results are provided for that claim.`

    const systemPrompt = `You are a research editor fact-checking a video script. You receive:
1. The full script
2. A list of pre-extracted claims
3. Web search results per claim (may be empty — stub mode)

You produce the final Research Report.

${groundingInstruction}

Return ONLY valid JSON (no markdown fences). Shape:
{
  "claims": [
    {
      "id": "<same id as the input claim>",
      "text": "<claim text>",
      "type": "<statistic | fact | date | claim>",
      "verdict": "<verified | needs-citation | weak | false | unverified>",
      "confidence": <0-100>,
      "snippet": "<verbatim phrase from script>",
      "field": "<title | hook | fullScript | cta | description>",
      "sources": [{ "url": "", "title": "", "domain": "", "publishedDate": "" }]
    }
  ],
  "suggestions": [
    {
      "id": "<stable id like 'rec-sha1-of-find'>",
      "type": "<fix-statistic | fix-date | replace-claim | add-context | remove-hallucination>",
      "field": "<title | hook | fullScript | cta | description>",
      "find": "<EXACT verbatim substring currently in the script — must match character-for-character>",
      "replace": "<the corrected or replacement text>",
      "rationale": "<one sentence: why this change, citing the source if grounded>",
      "confidence": <0-100>,
      "sources": [{ "url": "", "title": "", "domain": "" }]
    }
  ],
  "missingContext": [
    {
      "topic": "<what's missing>",
      "why": "<why it matters for credibility>",
      "suggestedAddition": "<one-line addition the user could write>",
      "priority": "<high | medium | low>"
    }
  ],
  "researchScore": {
    "overall":             <0-100, weighted blend>,
    "accuracy":            <0-100, % verified vs total claims>,
    "freshness":           <0-100, average source age score>,
    "credibility":         <0-100, source domain quality>,
    "citationCoverage":    <0-100, % claims with at least one source>
  }
}

Rules:
- "find" MUST be a literal substring of the script — it will be used as a string-replace target.
- "replace" should be the corrected text. Empty string is allowed for "remove-hallucination".
- Do not invent sources. If grounded=false, every claim's sources array MUST be empty.
- "confidence" reflects how certain you are — under stub mode, keep it < 25.
- Score honestly: in stub mode, accuracy and citationCoverage should be low (typically 0-30) since nothing is verified.
- Keep suggestion count reasonable — 3 to 8 actionable items, not 30 nitpicks.`

    const claimsForPrompt = claims.map((c) => {
      const results = searchResultsMap.get(c.text) || searchResultsMap.get(c.id) || []
      return `CLAIM ${c.id} (${c.type}, field=${c.field})
  text: ${c.text}
  snippet: "${c.snippet || ''}"
  search results (${results.length}):${
        results.length
          ? '\n' + results.map((r) => `    - ${r.title || '(no title)'} — ${r.url}\n      snippet: ${(r.snippet || '').slice(0, 280)}${r.publishedDate ? `\n      published: ${r.publishedDate}` : ''}`).join('\n')
          : '\n    (none)'
      }`
    }).join('\n\n')

    const userPrompt = `SCRIPT
  title:       ${script.title || ''}
  hook:        ${script.hook || ''}
  fullScript:  ${(script.fullScript || '').slice(0, 4000)}
  cta:         ${script.cta || ''}
  description: ${(script.description || '').slice(0, 600)}

CLAIMS TO VERIFY
${claimsForPrompt || '(no claims extracted — script may have no factual content)'}

MODE: ${grounded ? 'grounded (live web search)' : 'non-grounded (stub — no live web search)'}

Produce the Research Report now.`

    const scriptHashInput = `${script.title || ''}::${(script.fullScript || '').length}::${claims.length}::${grounded ? 'g' : 's'}`

    return this._execute(
      'analyzeScriptResearch',
      { scriptHash: scriptHashInput, channelId: ctx.channelId || '' },
      systemPrompt,
      userPrompt,
      { temperature: 0.3 },
    )
  }
}
