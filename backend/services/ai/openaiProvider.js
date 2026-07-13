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
  // Thumbnail Intelligence (Phase 3.1) — DNA is stable per channel; strategy
  // is stable per (channel, idea); similarity rescore is cheaper.
  analyzeThumbnailStyle: 168,
  generateThumbnailStrategy: 168,
  scoreThumbnailSimilarity: 24,
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
  // Thumbnail Intelligence (Phase 3.1) — deep visual-style reasoning
  'analyzeThumbnailStyle',
  'generateThumbnailStrategy',
])

function makeCacheKey(method, params) {
  const raw = method + '::' + JSON.stringify(params)
  return createHash('sha256').update(raw).digest('hex')
}

// ── Safely parse JSON from GPT response, with fallback ──────────────────
function parseJSON(text) {
  try {
    let cleaned = text
    // Strip scratchpad blocks the model sometimes leaves in the response
    // (Speech Engine Round 2: STEP 3 instructs a <scratchpad> block that
    // should be discarded — defensive strip in case the model didn't.)
    cleaned = cleaned.replace(/<scratchpad>[\s\S]*?<\/scratchpad>\s*/gi, '')
    // Strip markdown fences if present
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
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
  // Thumbnail Intelligence (Phase 3.1)
  analyzeThumbnailStyle(obj) {
    if (!obj || typeof obj !== 'object') return false
    if (typeof obj.summary !== 'string') return false
    return true
  },
  generateThumbnailStrategy(obj) {
    if (!obj || typeof obj !== 'object') return false
    if (!Array.isArray(obj.concepts)) return false
    if (typeof obj.prompt !== 'string' || obj.prompt.trim().length === 0) return false
    if (!obj.similarity || typeof obj.similarity !== 'object') return false
    if (typeof obj.similarity.overall !== 'number') return false
    return true
  },
  scoreThumbnailSimilarity(obj) {
    if (!obj || typeof obj !== 'object') return false
    if (!obj.similarity || typeof obj.similarity !== 'object') return false
    if (typeof obj.similarity.overall !== 'number') return false
    return true
  },
}


// ── speakingStyle renderers (Speech Engine 2.0) ───────────────────────────
// Pure formatters that turn the structured speakingStyle sub-objects into a
// readable block for the generator's user prompt. Each returns null if the
// sub-object is missing so the caller can filter blanks.

function spokenLanguageBlock(s) {
  if (!s || typeof s !== 'object') return null
  return `  Spoken Language:
    primary: ${s.primary ?? 'unknown'} | secondary: ${s.secondary ?? 'none'}
    Ratios — English ${fmtRatio(s.englishRatio)} / Hindi ${fmtRatio(s.hindiRatio)} / Other ${fmtRatio(s.otherRatio)} / Hinglish(within-sentence) ${fmtRatio(s.hinglishRatio)}
    Code-switch: ${s.codeSwitchFrequency || 'unknown'} @ ${s.codeSwitchLocation || 'n/a'} | Script: ${s.scriptPreference || 'unknown'}
    Technical words kept in English: ${fmtList(s.technicalWordsInEnglish)}
    Native connectors: ${fmtList(s.nativeConnectors)}`
}

function rhythmBlock(r) {
  if (!r || typeof r !== 'object') return null
  return `  Rhythm:
    avgSentenceLength: ${fmtNum(r.averageSentenceLengthWords)} words | speed: ${r.speakingSpeed || 'unknown'}
    Pauses — overall ${r.pauseFrequency || 'unknown'} | dramatic ${r.dramaticPauseFrequency || 'unknown'} | rhetorical-Q ${r.rhetoricalQuestionFrequency || 'unknown'}
    Punchline spacing: ${r.punchlineSpacing || 'unknown'} | repetition: ${r.repetitionFrequency || 'unknown'}`
}

function pauseStyleBlock(p) {
  if (!p || typeof p !== 'object') return null
  return `  Pause style: ${p.marker || 'none'}
    Examples: ${fmtList(p.examples)}`
}

function sentenceConstructionBlock(sc) {
  if (!sc || typeof sc !== 'object') return null
  return `  Sentence construction:
    fragments ${sc.fragmentFrequency || 'unknown'} | incomplete ${sc.incompleteThoughtFrequency || 'unknown'} | interruptions ${sc.interruptionFrequency || 'unknown'}
    avg beat length: ${fmtNum(sc.averageBeatLengthWords)} words`
}

function fillersBlock(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '  Conversational fillers: (none observed — do not invent any)'
  const items = arr.map((f) => `"${f.phrase}" (${f.frequency || '?'} @ ${f.position || '?'})`).join(', ')
  return `  Conversational fillers (use 2-4, never all): ${items}`
}

function transitionsBlock(t) {
  if (!t || typeof t !== 'object') return null
  return `  Transitions:
    topic change: ${fmtList(t.topicChange)}
    example intro: ${fmtList(t.exampleIntro)}
    punchline setup: ${fmtList(t.punchlineSetup)}`
}

function emotionalCurveBlock(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null
  const items = arr.map((b) => `${b.beat}→${b.emotion}@${fmtRatio(b.intensity)}`).join(' › ')
  return `  Emotional curve: ${items}`
}

function authorityBehaviourBlock(a) {
  if (!a || typeof a !== 'object') return null
  return `  Authority behaviour: ${fmtList(a.primary)}
    citation style: ${a.citationStyle || 'unknown'}
    examples: ${fmtList(a.examples)}`
}

function vocabularyBehaviourBlock(v) {
  if (!v || typeof v !== 'object') return null
  return `  Vocabulary behaviour:
    signature phrases: ${fmtList(v.signaturePhrases)}
    opening phrases: ${fmtList(v.openingPhrases)}
    closing phrases: ${fmtList(v.closingPhrases)}
    favorite expressions: ${fmtList(v.favoriteExpressions)}
    emphasis words: ${fmtList(v.emphasisWords)}`
}

function audienceAddressingBlock(a) {
  if (!a || typeof a !== 'object') return null
  return `  Audience addressing: primary "${a.primary || 'none'}" | alternatives ${fmtList(a.alternatives)} | frequency ${a.frequency || 'unknown'}`
}

function storytellingBlock(s) {
  if (!s || typeof s !== 'object') return null
  return `  Storytelling pattern:
    opening: ${s.opening || 'unknown'}
    example intro: ${s.exampleIntroduction || 'unknown'}
    key-idea repetition: ${s.keyIdeaRepetition || 'unknown'}
    conclusion: ${s.conclusionStyle || 'unknown'}
    CTA: ${s.ctaStyle || 'unknown'}`
}

// ── Round 2 speakingStyle renderers ──────────────────────────────────────
// Four new dimensions: how the creator talks TO the camera, their Q&A
// templates, observed repetition patterns, and how their speech diverges
// from written grammar.

function cameraFacingBlock(c) {
  if (!c || typeof c !== 'object') return null
  const youLines = Array.isArray(c.youYourUsage) && c.youYourUsage.length > 0
    ? c.youYourUsage.map((y) => `"${y.phrase}"@${y.context || '?'}`).join(', ')
    : '(none observed)'
  return `  Camera-facing style:
    direct address frequency: ${c.directAddressFrequency || 'unknown'}
    you/your/aap forms: ${youLines}
    eye-contact phrasing: ${fmtList(c.eyeContactPhrasing)}
    camera-pointing gestures: ${fmtList(c.cameraPointingGestures)}
    self-reference: ${c.selfReferenceStyle || 'unknown'}`
}

function qaPatternsBlock(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '  Q&A patterns: (none observed — skip self-Q&A beats)'
  const items = arr.map((q) => `Q:"${q.question}" → A:"${q.answer}" (${q.frequency || '?'} @ ${q.position || '?'})`).join(' ; ')
  return `  Q&A patterns (deploy 1-2 with the creator's template shape): ${items}`
}

function repetitionPatternsBlock(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '  Repetition patterns: (none observed — do not invent repetition)'
  const items = arr.map((r) => `"${r.instance}" [rule: ${r.rule || '?'} / purpose: ${r.purpose || '?'}]`).join(' ; ')
  return `  Repetition patterns (apply each RULE once with original wording — do not copy the instance verbatim): ${items}`
}

function spokenGrammarBlock(s) {
  if (!s || typeof s !== 'object') return null
  return `  Spoken grammar (apply EVERY divergence rule below — these are permissions to break written grammar):
    dropped subjects: ${s.droppedSubjects || 'unknown'} | dropped articles: ${s.droppedArticles || 'unknown'} | tense mixing: ${s.tenseMixing || 'unknown'}
    conjunction fronting: ${fmtList(s.conjunctionFronting)}
    sentence-starting patterns: ${fmtList(s.sentenceStartingPatterns)}
    divergence examples: ${fmtList(s.divergenceExamples)}`
}

function fmtRatio(n) {
  return typeof n === 'number' ? `${Math.round(n * 100)}%` : 'n/a'
}
function fmtNum(n) {
  return typeof n === 'number' ? String(n) : 'n/a'
}
function fmtList(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '(none)'
  return arr.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ')
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

  // ── Script Workspace — Creator DNA Engine ───────────────────────────────
  // Analyzes a creator's content corpus and builds a deep CreatorStyleProfile
  // that captures not just labels ("authoritative tone") but actual behavioral
  // DNA: how the creator constructs sentences, deploys authority, uses humor,
  // tells stories, transitions between ideas, and closes videos.
  //
  // Data source priority (graceful degradation):
  //   1. Video transcripts (when Video.transcript is populated in the future)
  //   2. Video descriptions  (fetched live via fetchVideoDescriptions)
  //   3. Video titles
  //   4. Channel description
  //
  // The resulting profile is consumed by generateStyledScript and
  // scoreScriptStyle — it's what makes the output sound like the creator
  // rather than generic AI prose.
  async analyzeCreatorStyle(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const channel = ctx.channel || {}
    const videos = Array.isArray(ctx.videos) ? ctx.videos : []

    let topVideos = videos.slice(0, 15)

    // ── Tier 0: ensure transcripts are cached for the corpus ────────────
    // Non-fatal. If this fails (no captions, package unavailable, network),
    // extraction falls through to titles + descriptions with calibrated
    // _speechDataConfidence. 14-day soft refresh window per video.
    try {
      const { ensureTranscriptsForVideos } = await import('../../services/transcriptService.js')
      await ensureTranscriptsForVideos(topVideos, { concurrency: 4 })
      const Video = (await import('../../models/Video.js')).default
      const fresh = await Video.find({
        videoId: { $in: topVideos.map((v) => v.videoId).filter(Boolean) },
      }).lean()
      const byId = new Map(fresh.map((v) => [v.videoId, v]))
      topVideos = topVideos.map((v) => ({ ...v, ...(byId.get(v.videoId) || {}) }))
    } catch (err) {
      console.warn('[CreatorDNA] Transcript prefetch failed (non-fatal):', err?.message || err)
    }

    // ── Build content corpus (priority-ordered) ───────────────────────────
    // Tier 1: transcripts (now populated by Tier 0 above)
    const transcriptLines = []
    for (const v of topVideos) {
      if (v.transcript && typeof v.transcript === 'string' && v.transcript.trim()) {
        transcriptLines.push(`[TRANSCRIPT] "${v.title}":\n${v.transcript.trim().substring(0, 800)}`)
      }
    }

    // Tier 2: video descriptions (fetched live from YouTube API)
    let descriptionLines = []
    try {
      const videoIds = topVideos.map((v) => v.videoId).filter(Boolean)
      if (videoIds.length) {
        const { fetchVideoDescriptions } = await import('../../services/youtubeService.js')
        const descData = await fetchVideoDescriptions(videoIds)
        const descMap = new Map(descData.map((d) => [d.videoId, d.description]))
        for (const v of topVideos) {
          const desc = descMap.get(v.videoId)
          if (desc && desc.length > 80) {
            // Strip pure SEO/link sections — keep the first 400 chars (usually the actual description copy)
            const cleanDesc = desc.split(/\n{2,}/)[0].trim().substring(0, 400)
            if (cleanDesc.length > 60) {
              descriptionLines.push(`[DESC] "${v.title}":\n${cleanDesc}`)
            }
          }
        }
      }
    } catch (descErr) {
      // Non-fatal — fall through to titles-only
      console.warn('[CreatorDNA] Description fetch skipped:', descErr.message)
    }

    // Tier 3: titles
    const titleLines = topVideos.map((v, i) =>
      `  ${i + 1}. "${v.title || '(untitled)'}" — ${v.views || 0} views, ${v.likes || 0} likes`
    )

    // Determine data source label for styleConfidence
    const hasTranscripts = transcriptLines.length > 0
    const hasDescriptions = descriptionLines.length > 0
    const dataSourceLabel = hasTranscripts
      ? 'transcripts'
      : hasDescriptions
        ? 'descriptions'
        : titleLines.length
          ? 'titles'
          : 'channel-description'

    // Assemble corpus string — richest sources at top
    const corpusSections = []
    if (transcriptLines.length) {
      corpusSections.push(`=== TRANSCRIPTS (highest priority — actual spoken language) ===\n${transcriptLines.join('\n\n')}`)
    }
    if (descriptionLines.length) {
      corpusSections.push(`=== VIDEO DESCRIPTIONS (written copy — secondary source) ===\n${descriptionLines.join('\n\n')}`)
    }
    if (titleLines.length) {
      corpusSections.push(`=== VIDEO TITLES (packaging signals) ===\n${titleLines.join('\n')}`)
    }
    const contentCorpus = corpusSections.join('\n\n') || '(no content data available)'

    const systemPrompt = `You are a Creator DNA Analyst. Your job is to reverse-engineer how a specific content creator thinks, speaks, teaches, persuades, and structures content — based on their actual content corpus.

The profile you build is used downstream to generate entirely new scripts that feel like the creator actually wrote and spoke them. The richer and more accurate this profile, the better the generated scripts will sound.

DATA SOURCE PRIORITY (highest to lowest):
1. Transcripts — actual spoken words (most valuable: captures rhythm, vocabulary, phrasing, humor)
2. Video descriptions — written copy (captures vocabulary, structure, authority style)
3. Video titles — packaging signals (captures hook style, audience framing, topic patterns)
4. Channel description — brand positioning (supplementary only)

CONFIDENCE CALIBRATION:
- transcripts available → overall confidence ≥ 0.80
- descriptions available (no transcripts) → overall confidence 0.55–0.75
- titles only → overall confidence 0.30–0.50
- ≥ 10 videos analyzed → add +0.10 to overall
- high consistency across videos → add +0.05 to overall
- Cap at 1.0

SPEECH EXTRACTION GUIDANCE:
The \`speakingStyle\` block below captures HOW THE CREATOR SPEAKS — not what they write. This is the single most important signal for downstream script generation. Every value should be grounded in concrete evidence from the corpus.

- When transcripts are available, extract OBSERVED data: real filler words actually spoken, real pause patterns, real code-switching points, real audience-addressing words. Quote them verbatim.
- When only descriptions/titles are available (no actual spoken content), you MUST mark uncertain fields \`null\` rather than guessing. Do not invent fillers, pauses, or audience-addressing words from titles alone. Set \`speakingStyle._speechDataConfidence\` to \`"packaging-inferred"\` so the generator knows to apply these signals conservatively.
- Code-switching ratios (englishRatio / hindiRatio / hinglishRatio) must sum to roughly 1.0 across the three. Hinglish = within-sentence mix of Hindi + English.
- conversationalFillers must be a list of OBSERVED phrases with frequency and position — never generic defaults. If no real speech data exists, return an empty array.
- audienceAddressing.primary must be a real word the creator uses to address viewers (e.g. "Dosto", "Guys", "Friends", "Aap log"). If you cannot find evidence, set to "none".
- emotionalCurve is an ordered list — first beat to last beat — showing how emotional intensity shifts across a typical video. Use stage names like Hook, Curiosity, Problem, Fear, Explanation, Example, Solution, Relief, CTA.
- Do NOT hardcode any creator. Every value must come from the corpus. If the corpus is silent on a dimension, return \`null\` or an empty array — do NOT guess.

Return ONLY valid JSON (no markdown fences). Shape:
{
  "summary": "<2-3 sentence plain-English description of this creator's voice, teaching style, and content identity>",

  "creatorPersona": "<one of: teacher | advisor | storyteller | consultant | journalist | entertainer | analyst | coach>",
  "brandVoice": "<one of: premium | educational | authoritative | friendly | humorous | corporate | luxury | minimal>",
  "audienceProfile": {
    "primarySegment": "<one of: beginners | professionals | founders | investors | students | taxpayers | creators | general>",
    "sophisticationLevel": "<one of: beginner | intermediate | advanced>",
    "description": "<1-line audience description>"
  },
  "psychologicalTriggers": ["<3-5 from: curiosity | fear | urgency | authority | loss-aversion | aspiration | social-proof | FOMO>"],
  "openingFormula": "<one of: shocking-statistic | personal-story | bold-statement | question | myth-busting | breaking-news | emotional-hook | contrarian-take>",
  "storyStructure": ["<ordered list of sections the creator consistently uses, e.g. Hook, Problem, Explanation, Example, Proof, Solution, CTA>"],
  "humorLevel": "<one of: very-serious | light-humor | heavy-humor | sarcastic>",
  "emotionalLevel": "<one of: very-emotional | balanced | mostly-logical | highly-analytical>",

  "languageMix": { "english": <0-1>, "hindi": <0-1>, "other": <0-1> },
  "avgTitleLengthChars": <number>,
  "titleStyle": "<one of: curiosity-question | bold-claim | listicle | story-teaser | how-to | controversy | numeric-claim>",
  "energyLevel": <0-1>,
  "humorLevel_score": <0-1>,
  "hookStyle": "<one of: curiosity-question | bold-claim | story-cold-open | stat-shock | pattern-interrupt | contrarian-take>",
  "ctaStyle": "<one of: soft-invite | direct-ask | community-build | reward-promise | curiosity-loop>",
  "ctaFormula": ["<2-4 actual CTA phrases or patterns the creator likely uses, e.g. 'Save this video', 'Share this with every taxpayer'>"],
  "retentionTechniques": ["<3-6 techniques this creator uses>"],
  "writingTone": "<one of: authoritative | conversational | hype | educational | inspirational | analytical>",
  "estimatedAudience": "<1-line description>",

  "authorityStyle": ["<2-4 from: government-refs | laws-sections | reports | statistics | research | personal-experience | case-studies | news | expert-quotes>"],
  "evidenceStyle": ["<2-4 from: numbers | legal-sections | examples | stories | analogies | charts | news | real-cases>"],

  "vocabulary": {
    "formality": <0-1, 0=very casual 1=very formal>,
    "technicality": <0-1>,
    "signatureWords": ["<5-12 words or short phrases this creator uses repeatedly>"],
    "recurringPhrases": ["<3-6 multi-word phrases they repeat across videos>"],
    "favoriteTransitions": ["<3-5 transition phrases they use, e.g. 'Now here is the thing', 'Let me give you an example'>"],
    "fillerWords": ["<2-4 filler expressions if apparent>"],
    "emphasisWords": ["<3-5 words they stress or repeat for impact>"]
  },

  "signaturePatterns": ["<3-6 recurring structural or behavioral quirks, e.g. 'always opens with a statistic', 'always gives 3 examples', 'always ends with one actionable takeaway'>"],

  "thumbnailStyle": {
    "density": "<sparse | medium | dense>",
    "primaryColor": "<hex or named color guess>",
    "textStyle": "<minimal | bold-overlay | heavy-text>",
    "faceStyle": "<none | expressive-closeup | small-inset>"
  },

  "speechDNA": {
    "averageSentenceLength": "<short | medium | long>",
    "sentenceComplexity": <0-1, 0=very simple 1=complex compound>,
    "shortVsLongSentenceRatio": "<mostly-short | balanced | mostly-long>",
    "questionDensity": <0-1>,
    "pauseFrequency": "<low | medium | high>",
    "punchlineFrequency": "<low | medium | high>",
    "analogyFrequency": "<low | medium | high>",
    "statisticFrequency": "<low | medium | high>",
    "legalReferenceFrequency": "<none | low | medium | high>",
    "storyFrequency": "<low | medium | high>",
    "humorFrequency": "<low | medium | high>",
    "repetitionFrequency": "<low | medium | high>",
    "englishHindiSwitchFrequency": "<none | low | medium | high>",
    "emphasisStyle": "<one of: bold-claim | repetition | contrast | rhetorical-question | pause>",
    "pacingStyle": "<one of: rapid-fire | measured | slow-build | alternating>",
    "explanationDepth": "<one of: surface | medium | deep-dive>",
    "curiosityLoops": "<one of: rare | occasional | frequent>",
    "suspenseUsage": "<one of: none | light | heavy>"
  },

  "speakingStyle": {
    "_speechDataConfidence": "<one of: transcripts | descriptions | packaging-inferred>",
    "spokenLanguage": {
      "primary": "<language name or ISO, e.g. English | Hindi | Hinglish | Tamil | Spanish>",
      "secondary": "<language name or null>",
      "englishRatio": <0-1>,
      "hindiRatio": <0-1>,
      "otherRatio": <0-1>,
      "hinglishRatio": <0-1, the within-sentence mix fraction>,
      "codeSwitchFrequency": "<one of: none | low | medium | high>",
      "codeSwitchLocation": "<one of: within-sentence | between-sentence | both>",
      "scriptPreference": "<one of: latin | devanagari | mixed>",
      "technicalWordsInEnglish": ["<2-6 domain terms the creator keeps in English, e.g. mutual funds, tax, EMI, ROI>"],
      "nativeConnectors": ["<2-5 native-language connector words actually used, e.g. aur, lekin, matlab, kyunki>"]
    },
    "rhythm": {
      "averageSentenceLengthWords": <number or null>,
      "pauseFrequency": "<one of: none | low | medium | high>",
      "dramaticPauseFrequency": "<one of: none | low | medium | high>",
      "rhetoricalQuestionFrequency": "<one of: none | low | medium | high>",
      "punchlineSpacing": "<one of: tight | medium | wide>",
      "repetitionFrequency": "<one of: none | low | medium | high>",
      "speakingSpeed": "<one of: slow | measured | fast | alternating>"
    },
    "pauseStyle": {
      "marker": "<one of: ellipsis | line-break | em-dash | explicit-word | none>",
      "examples": ["<3-5 short strings showing actual pause placement observed, e.g. 'Dekhiye...' or 'Simple.\\nBahut simple.'>"]
    },
    "sentenceConstruction": {
      "fragmentFrequency": "<one of: none | low | medium | high>",
      "incompleteThoughtFrequency": "<one of: none | low | medium | high>",
      "interruptionFrequency": "<one of: none | low | medium | high>",
      "averageBeatLengthWords": <number or null>
    },
    "conversationalFillers": [
      { "phrase": "<observed word or phrase, e.g. Dekhiye | Acha | Matlab | Honestly | Believe me | Right?>", "frequency": "<one of: low | medium | high>", "position": "<one of: opening | mid | closing | punchline>" }
    ],
    "transitions": {
      "topicChange": ["<3-5 actual transition phrases observed, e.g. Lekin..., Ab problem kya hai?, Ab asli baat.>"],
      "exampleIntro": ["<2-3 phrases, e.g. Ek example dekhte hain.>"],
      "punchlineSetup": ["<2-3 phrases>"]
    },
    "emotionalCurve": [
      { "beat": "<stage name, e.g. Hook | Curiosity | Problem | Fear | Explanation | Example | Solution | Relief | CTA>", "emotion": "<emotion word>", "intensity": <0-1> }
    ],
    "authorityBehaviour": {
      "primary": ["<2-4 from: laws | statistics | stories | analogies | government-notifications | personal-experience | case-studies | screenshots | expert-quotes>"],
      "citationStyle": "<one-line description of how this creator cites sources>",
      "examples": ["<2-3 short observed citation snippets>"]
    },
    "vocabularyBehaviour": {
      "signaturePhrases": ["<5-8 multi-word phrases the creator repeats>"],
      "openingPhrases": ["<3-5 phrases used to open beats>"],
      "closingPhrases": ["<3-5 phrases used to close beats>"],
      "favoriteExpressions": ["<3-5 idioms or recurring expressions>"],
      "emphasisWords": ["<3-5 words stressed for impact>"]
    },
    "audienceAddressing": {
      "primary": "<real word used: Dosto | Guys | Friends | Aap log | Investors | Founders | Bhai | Viewers | none>",
      "alternatives": ["<2-3 other forms used>"],
      "frequency": "<one of: none | low | medium | high>"
    },
    "storytellingPattern": {
      "opening": "<one of: cold-open-story | shocking-stat | question | bold-claim | myth-bust | personal-anecdote>",
      "exampleIntroduction": "<one-line description>",
      "keyIdeaRepetition": "<one-line description of how main points get repeated>",
      "conclusionStyle": "<one-line description>",
      "ctaStyle": "<one-line description>"
    },
    "speakingPersona": "<one of: teacher | advisor | friend | mentor | consultant | journalist | storyteller | coach>",

    "cameraFacingStyle": {
      "directAddressFrequency": "<one of: none | low | medium | high — how often the creator speaks directly TO the viewer vs. about the topic>",
      "youYourUsage": [
        { "phrase": "<verbatim 'you' / 'your' / 'aap' / 'tum' / 'tumhara' form observed in transcript>", "context": "<one of: hook | teaching | caution | cta>" }
      ],
      "eyeContactPhrasing": ["<2-4 verbatim lines where the creator speaks directly TO the viewer, e.g. 'Dekho...', 'Sun-na...', 'Let me ask you something.'>"],
      "cameraPointingGestures": ["<1-3 verbatim 'look at this' / 'dekho yahan' / 'notice this' style lines if observed, else []>"],
      "selfReferenceStyle": "<one of: first-person-singular 'main' | first-person-plural 'hum' | third-person 'your teacher' | mixed | none>"
    },

    "qaPatterns": [
      {
        "question": "<verbatim question observed in transcript, e.g. 'Kyunki yeh zaroori kyun hai?' | 'So why does this matter?' | 'Aap soch rahe hain yeh kaise?'>",
        "answer": "<verbatim answer or answer-opening observed, e.g. 'Because...' | 'Dekhiye...' | 'Iska jawab hai...'>",
        "position": "<one of: hook | explanation | example | transition | punchline>",
        "frequency": "<one of: rare | occasional | frequent>"
      }
    ],

    "repetitionPatterns": [
      {
        "instance": "<verbatim repetition observed, e.g. 'Simple. Bahut simple.' | 'Socho. Ek minute socho.' | 'Yeh important hai. Bahut important.'>",
        "rule": "<one-line description of the pattern this demonstrates, e.g. 'short-declarative-then-amplifier' | 'imperative-then-pause-then-reinforcement'>",
        "purpose": "<one of: emphasis | memorability | dramatic-effect | structural-marker>"
      }
    ],

    "spokenGrammar": {
      "droppedSubjects": "<one of: never | occasionally | frequently — does the creator drop 'main'/'I'/'we' when context is clear?>",
      "droppedArticles": "<one of: never | occasionally | frequently>",
      "tenseMixing": "<one of: never | occasionally | frequently — does the creator mix past/present in the same beat?>",
      "conjunctionFronting": ["<2-3 verbatim examples if observed, e.g. 'Lekin...', 'Kyunki...', 'Aur yahan...', 'Because...'>"],
      "sentenceStartingPatterns": ["<3-5 verbatim patterns of how beats BEGIN, since spoken language recycles openers heavily>"],
      "divergenceExamples": ["<2-4 short verbatim snippets where this creator's speech is grammatically non-standard in a way writing would correct>"]
    }
  },

  "styleExamples": {
    "hookExamples": ["<2-3 representative hook snippets, 15-35 words each. If synthesized from titles, append (synthesized)>"],
    "openingExamples": ["<2-3 representative opening lines or patterns>"],
    "transitionExamples": ["<2-3 transition phrases or sentences the creator uses>"],
    "storyExamples": ["<1-2 short story setups or narrative patterns, 20-40 words each>"],
    "analogyExamples": ["<1-2 analogy patterns they use>"],
    "ctaExamples": ["<2-3 specific CTA formulations, e.g. 'Save this video right now', 'Share this with your CA'>"],
    "closingExamples": ["<1-2 closing line patterns>"],
    "authorityExamples": ["<1-2 examples of how they cite authority, e.g. 'Section 80C of Income Tax Act says...'>"],
    "objectionHandlingExamples": ["<1-2 examples of how they handle viewer doubts or objections>"],
    "humorExamples": ["<1-2 humor patterns if applicable, null if very-serious>"]
  },

  "styleConfidence": {
    "overall": <0-1>,
    "vocabulary": <0-1>,
    "rhythm": <0-1>,
    "persona": <0-1>,
    "authority": <0-1>,
    "storytelling": <0-1>,
    "humor": <0-1>,
    "CTA": <0-1>,
    "emotionalTone": <0-1>,
    "dataSource": "<transcripts | descriptions | titles | channel-description>",
    "videoCount": <number of videos in corpus>
  }
}

RULES:
- Every 0-1 numeric score must be a number, not a string.
- speechDNA must ALWAYS be present. Infer values statistically from the corpus. If working from titles-only, mark high-uncertainty fields with a "~" prefix in string values (e.g. "~medium") to signal lower confidence.
- speakingStyle must ALWAYS be present. Mark \`_speechDataConfidence\` honestly. When real spoken content is unavailable, set uncertain numeric fields to \`null\` and return empty arrays for conversationalFillers / transitions / audienceAddressing.alternatives — do NOT invent observed data.
- speakingStyle.emotionalCurve must list at least 3 beats in performance order (Hook … CTA).
- speakingStyle.cameraFacingStyle / qaPatterns / repetitionPatterns / spokenGrammar MUST be null (or all-arrays-empty + frequency fields "unknown") when \`_speechDataConfidence\` is "packaging-inferred". When real transcripts are available, these four blocks MUST be populated with verbatim observed quotes — never synthesize from titles or descriptions. These are the highest-signal dimensions for camera-facing delivery, so populate them carefully from transcript evidence.
- styleExamples: extract SHORT snippets (15-40 words max). If no actual spoken content is available, synthesize plausible examples and append "(synthesized)". These are patterns to IMITATE STRUCTURALLY — not sentences to copy.
- styleConfidence must be calibrated honestly: titles-only = low, descriptions = medium, transcripts = high. Add bonuses for video count and consistency.
- All legacy fields (summary, languageMix, vocabulary, hookStyle, ctaStyle, retentionTechniques, thumbnailStyle, writingTone, estimatedAudience) must remain present — new schema is a strict superset.
- Do not invent facts. Use null only for fields that are genuinely unknowable from the available data.
- Do not hardcode any creator. Every speakingStyle value must trace back to evidence in the corpus.`

    const userPrompt = `CHANNEL
  Title: ${channel.title || '(unknown)'}
  Handle: ${channel.handle || '(none)'}
  Description: ${(channel.description || '(none provided)').substring(0, 600)}
  Subscribers: ${channel.subscribers || 0}
  Total videos: ${channel.totalVideos || 0}

DATA SOURCE: ${dataSourceLabel} (${topVideos.length} videos in corpus)

CONTENT CORPUS
${contentCorpus}

Build the complete Creator DNA Profile now. Be analytical, specific, and honest about confidence.`

    return this._execute(
      'analyzeCreatorStyle',
      { channelId, dataSource: dataSourceLabel, videoCount: topVideos.length, _profileVersion: 3 },
      systemPrompt,
      userPrompt,
      { temperature: 0.4 },
    )
  }


  // Generates a complete script for a recommended concept, shaped to reproduce
  // the creator's actual voice — not generic AI prose. Consumes all layers of
  // the Creator DNA profile built by analyzeCreatorStyle.
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

    // ── Confidence-modulated generation instruction ───────────────────────
    const confidence = creatorStyle.styleConfidence?.overall ?? 0.5
    const confidenceInstruction = confidence >= 0.70
      ? 'The Creator DNA profile is HIGH CONFIDENCE (built from rich content data). Imitate the creator\'s voice AGGRESSIVELY — every stylistic choice should trace back to a learned signal.'
      : confidence >= 0.40
        ? 'The Creator DNA profile is MEDIUM CONFIDENCE (built from limited data). Imitate moderately — replicate clear patterns, use conservative estimates where signals were weak.'
        : 'The Creator DNA profile is LOW CONFIDENCE (built from titles only). Imitate CONSERVATIVELY — apply strong signals only, avoid over-fitting to weak inferences.'

    // ── Mode instruction ──────────────────────────────────────────────────
    const modeInstruction = mode === 'similar'
      ? 'STAY CLOSE to the creator\'s established patterns — minimal creative deviation.'
      : mode === 'creative'
        ? 'MILD creative deviation — try a fresh angle on the topic, but keep every aspect of the voice intact.'
        : 'FULLY fresh take — surprise the audience with unexpected framing, but the voice must still feel unmistakably like this creator.'

    // ── Build styleExamples block for the prompt ──────────────────────────
    const examples = creatorStyle.styleExamples || {}
    const examplesBlock = Object.entries(examples)
      .filter(([, v]) => Array.isArray(v) && v.length > 0)
      .map(([key, snippets]) => `  ${key}:\n${snippets.map((s) => `    - "${s}"`).join('\n')}`)
      .join('\n')

    // ── speechDNA block for the prompt ────────────────────────────────────
    const dna = creatorStyle.speechDNA || {}
    const dnaBlock = Object.entries(dna)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n')

    // ── speakingStyle block (Speech Engine 2.0) ───────────────────────────
    // Renders the structured speakingStyle object as a readable block. The
    // generator's SPEECH-FIRST RULES reference these fields by name.
    const speakingStyle = creatorStyle.speakingStyle || null
    const speakingStyleBlock = !speakingStyle
      ? null
      : [
          `  _speechDataConfidence: ${speakingStyle._speechDataConfidence || 'unknown'}`,
          `  Speaking Persona: ${speakingStyle.speakingPersona || 'unknown'}`,
          spokenLanguageBlock(speakingStyle.spokenLanguage),
          rhythmBlock(speakingStyle.rhythm),
          pauseStyleBlock(speakingStyle.pauseStyle),
          sentenceConstructionBlock(speakingStyle.sentenceConstruction),
          fillersBlock(speakingStyle.conversationalFillers),
          transitionsBlock(speakingStyle.transitions),
          emotionalCurveBlock(speakingStyle.emotionalCurve),
          authorityBehaviourBlock(speakingStyle.authorityBehaviour),
          vocabularyBehaviourBlock(speakingStyle.vocabularyBehaviour),
          audienceAddressingBlock(speakingStyle.audienceAddressing),
          storytellingBlock(speakingStyle.storytellingPattern),
          cameraFacingBlock(speakingStyle.cameraFacingStyle),
          qaPatternsBlock(speakingStyle.qaPatterns),
          repetitionPatternsBlock(speakingStyle.repetitionPatterns),
          spokenGrammarBlock(speakingStyle.spokenGrammar),
        ].filter(Boolean).join('\n')

    const systemPrompt = `You are a master ghostwriter specializing in voice reproduction. Your sole objective is to write a video script that sounds like this specific creator actually spoke it on camera — a fresh transcript, not a polished article.

You have been given a Creator DNA Profile containing everything learned about how this creator thinks, speaks, teaches, persuades, and structures content — including a structured \`speakingStyle\` block that captures their spoken-language identity, rhythm, pauses, fillers, transitions, and audience-addressing style.

═══════════════════════════════════════════════════════
SPEECH-FIRST RULES (override every other instruction on conflict)
═══════════════════════════════════════════════════════

You are transcribing a brand-new video from this creator. NOT writing an article. The output must read like spoken dialogue, not prose.

FORMAT:
- Each spoken beat = 1-3 sentences maximum, then a paragraph break (\\n\\n).
- NEVER write a paragraph longer than 4 sentences.
- Use natural pauses: "..." for a dramatic pause, "\\n\\n" for a beat break, "—" for an interruption.
- Sentence fragments are GOOD. ("Simple." is a complete spoken beat.)
- Incomplete thoughts are GOOD. Repetition for emphasis is GOOD. ("Simple. Bahut simple.")
- Vary beat length — some single-word beats, some 3-sentence teaching beats.

LANGUAGE & CODE-SWITCHING:
- Match the creator's spokenLanguage mix EXACTLY. If they say "Aaj hum baat karenge mutual funds ke baare mein", you write that — NOT "Today we will discuss mutual funds."
- Code-switch at the same locations the creator does (within-sentence / between-sentence, per speakingStyle.spokenLanguage.codeSwitchLocation).
- Preserve technical words in English if the creator does (speakingStyle.spokenLanguage.technicalWordsInEnglish).
- Use native connectors naturally (aur, lekin, matlab, kyunki, etc.) — never translate them away.

FILLERS & ADDRESSING (use sparingly, never force):
- Weave in 2-4 of the observed conversationalFillers at natural conversational points.
- Do NOT use all of them. Do NOT use any single filler more than once every ~80 words.
- Address the audience using the observed audienceAddressing.primary form at least once. Use alternatives if the script is long.
- Use transitions.topicChange / exampleIntro phrases where the creator would.

EMOTIONAL CURVE:
- Follow speakingStyle.emotionalCurve as the progression of the script. Each beat should land on the next intended emotion.

ANTI-PATTERNS (NEVER DO THESE — instant failure):
- "In today's video, we will explore..." → instead open with the learned opening phrase
- Long grammatical compound sentences with multiple "and" / "which" clauses
- Essay transitions: "Furthermore...", "Additionally...", "In conclusion...", "Moreover..."
- Bullet points or numbered lists inside spoken text
- "Hope you enjoyed this video" / "Thanks for watching" closings
- Generic "like and subscribe" CTAs
- Translating observed Hinglish/Hindi/etc. into clean English

These rules are non-negotiable. A script that reads like an article is a failure even if every other signal matches.

═══════════════════════════════════════════════════════
STEP 1 — BUILD YOUR CREATOR VOICE CHECKLIST (internal)
═══════════════════════════════════════════════════════

Before writing a single word, internally construct a Creator Voice Checklist from the DNA profile. Pull from BOTH the legacy fields AND the speakingStyle block:

  ✓ Opens with: [learned openingFormula]
  ✓ Speaking persona: [speakingStyle.speakingPersona]
  ✓ Audience addressing: [speakingStyle.audienceAddressing.primary] — use at least once
  ✓ Conversational fillers: 2-4 from [speakingStyle.conversationalFillers], paced naturally
  ✓ Language mix: [speakingStyle.spokenLanguage] ratios — match exactly
  ✓ Code-switch points: [codeSwitchLocation] — switch at the same locations
  ✓ Native connectors: [nativeConnectors] — never translate away
  ✓ Sentence rhythm: target ~[rhythm.averageSentenceLengthWords] words per sentence
  ✓ Pause style: [pauseStyle.marker] — use [pauseStyle.examples] as templates
  ✓ Beat structure: 1-3 sentences per paragraph, [sentenceConstruction.fragmentFrequency] fragments OK
  ✓ Transitions: use [transitions.topicChange] / [transitions.exampleIntro] where natural
  ✓ Emotional curve: follow [emotionalCurve] progression
  ✓ Authority style: cite [authorityBehaviour.primary] naturally
  ✓ CTA formula: close with [ctaFormula pattern]
  ✓ Signature words / phrases: weave in [vocabulary.signaturePhrases] / [vocabularyBehaviour.signaturePhrases]
  ✓ Psychological triggers: activate [psychologicalTriggers] at natural points
  ✓ Story structure: follow [storyStructure] for body sections
  ✓ Camera-facing: use [speakingStyle.cameraFacingStyle.youYourUsage] forms naturally; deploy [cameraFacingStyle.eyeContactPhrasing] at least once if observed
  ✓ Q&A patterns: deploy 1-2 of the observed [speakingStyle.qaPatterns] at natural points — same question shape, original wording
  ✓ Repetition patterns: apply each [speakingStyle.repetitionPatterns.rule] ONCE with original wording (do not copy the instance verbatim)
  ✓ Spoken grammar: apply EVERY [speakingStyle.spokenGrammar] divergence rule (dropped subjects, dropped articles, conjunction fronting, tense mixing) — these are permissions to break written-grammar rules

Adapt this checklist to whatever signals are in the actual profile provided. When speakingStyle fields are null or _speechDataConfidence is "packaging-inferred", apply the speech patterns conservatively — still prefer short beats and fragments over article-style prose, but do not invent specific filler words.

═══════════════════════════════════════════════════════
STEP 2 — STUDY THE STYLE EXAMPLES
═══════════════════════════════════════════════════════

Study the styleExamples to internalize the creator's rhythm, pacing, vocabulary, sentence construction, and tone.

CRITICAL RULES for examples:
- DO NOT copy any example verbatim
- DO NOT paraphrase examples
- USE them only to understand the STRUCTURAL PATTERN, CADENCE, and VOCABULARY STYLE
- Generate entirely original sentences that feel like the same creator speaking

═══════════════════════════════════════════════════════
STEP 3 — DRAFT IN WRITER MODE (mandatory, in scratchpad)
═══════════════════════════════════════════════════════

Inside a <scratchpad>...</scratchpad> block (which comes BEFORE your final JSON output), write a FIRST DRAFT of the script as you would naturally write it for an article-style explainer on this topic. Use proper grammar, full sentences, paragraph flow. ~400-700 words.

This draft is for YOU to transform in Step 4. It will not be shown to the user. Be thorough — cover every section of the storyStructure, work through the recommendation content, and get the substance right.

DO NOT skip the scratchpad. The transformation step in Step 4 needs source material to work on. A scratchpad-less output is a guaranteed failure.

═══════════════════════════════════════════════════════
STEP 4 — TRANSCRIPTIONIST'S HEADPHONES (the transformation)
═══════════════════════════════════════════════════════

Now switch roles. You are no longer the writer. You are a transcriptionist wearing headphones, listening to a recording of THIS SPECIFIC CREATOR reading your Step 3 draft aloud on camera. They are not reading it verbatim — they are SPEAKING it, the way they actually speak on camera. Your job is to transcribe what you hear.

A transcriptionist does not "polish" or "improve" what they hear. A transcriptionist captures:
- Sentence fragments (the creator trails off, then restarts)
- Repetitions for emphasis ("Simple. Bahut simple.")
- Pause markers (... and em-dashes where they pause or interrupt themselves)
- Dropped subjects, dropped articles ("Went to the store yesterday" — not "I went to the store yesterday")
- Code-switching at the EXACT points this creator switches languages
- Fillers where they actually occur ("Dekhiye...", "Matlab...", "Right?")
- Self-asked Q&A patterns where the creator asks then answers themselves
- Direct address to camera ("Aap dekho...", "Let me show you...")
- Conjunction-fronting ("Lekin...", "Kyunki...", "Because..." starting a beat)

Transform your Step 3 draft into a transcription of THIS CREATOR speaking it aloud. Concretely:
- Apply speakingStyle.cameraFacingStyle — direct address patterns, you/your/aap usage
- Insert 1-2 self-Q&A beats using the SHAPE of observed speakingStyle.qaPatterns (not verbatim — original question + answer with the same structural template)
- Apply each speakingStyle.repetitionPatterns RULE once with original wording (not the verbatim instance)
- Apply EVERY speakingStyle.spokenGrammar divergence rule — drop subjects where they drop them, front conjunctions where they front them, mix tenses where they mix them
- Apply the existing rhythm / fillers / transitions / pause / audience-addressing signals from the profile
- Beat-structure: each paragraph is 1-3 spoken sentences, then \\n\\n. NEVER longer than 4 sentences in one beat.

The output of Step 4 goes into the JSON \`fullScript\` field. NOT the Step 3 draft.

If your Step 4 output reads like polished prose, you have FAILED. Re-transcribe until it sounds like the creator actually spoke it.

═══════════════════════════════════════════════════════
STEP 5 — WRITE THE SCRIPT (final output)
═══════════════════════════════════════════════════════

The fullScript in your JSON output is the Step 4 transcription. Build the final JSON shape satisfying your Creator Voice Checklist from Step 1, with the SPEECH-FIRST RULES fully applied.

Return ONLY valid JSON (no markdown fences). The scratchpad block must come BEFORE the JSON opening brace. Shape:
{
  "title": "<final CTR-optimized title under 70 chars, in the creator's exact title style>",
  "hook": "<0-10 second hook — the first words spoken. Must match the learned openingFormula. 1-3 sentences max. May include a pause marker or fragment if the creator opens that way.>",
  "fullScript": "<the complete spoken script, formatted as natural speech. Each paragraph = one spoken beat (1-3 sentences). Use \\n\\n between beats. Use '...' for dramatic pauses where pauseStyle.marker suggests it. Use the creator's exact language mix and code-switching pattern. Use observed fillers sparingly (2-4 total). Use sentence fragments where the creator would. Follow the emotionalCurve progression. Target 400-900 words; prioritize SPEECH FEEL over length — never pad to hit a word count.>",
  "cta": "<end-of-video call to action. Must match the learned ctaFormula and speakingStyle.storytellingPattern.ctaStyle — never generic.>",
  "description": "<YouTube video description in the creator's voice, 100-300 words. Start with a punchy hook line, then context. Match vocabulary and tone.>",
  "hashtags": [<8-15 relevant hashtags, no # prefix>],
  "styleMatch": {
    "overall": <number 0-100>,
    "language": <number 0-100>,
    "hook": <number 0-100>,
    "flow": <number 0-100>,
    "rhythm": <number 0-100>,
    "vocabulary": <number 0-100>,
    "retention": <number 0-100>,
    "persona": <number 0-100>,
    "authority": <number 0-100>,
    "storyStructure": <number 0-100>,
    "psychologicalTriggers": <number 0-100>,
    "speechRhythm": <number 0-100>,
    "sentenceStyle": <number 0-100>,
    "CTA": <number 0-100>,
    "languageMix": <number 0-100>
  }
}

═══════════════════════════════════════════════════════
STEP 6 — SPEECH SELF-VERIFICATION (mandatory)
═══════════════════════════════════════════════════════

Before outputting the final JSON, read the fullScript aloud in your head at the creator's natural speaking pace and answer this question honestly:

  "If this were converted to speech with the creator's own voice, would existing subscribers believe this creator actually recorded it?"

If NO — for ANY of these reasons — silently REWRITE the script before returning:
- It sounds like an article, blog post, or essay
- Any paragraph is longer than 4 sentences
- No natural pauses ("..." or paragraph breaks), no fragments, no repetition
- Language is too polished, formal, or textbook
- Code-switching doesn't match the creator's pattern (no Hinglish/Hindi/etc. where they would use it)
- No conversational fillers used anywhere (or every filler used, which is just as bad)
- No audience addressing in a script longer than 200 words
- Opens with "In today's video..." / "Welcome back..." / "In this video..." or similar generic framing
- Closes with "Thanks for watching" / "Hope you enjoyed" generic closings
- No use of any observed qaPatterns when they were provided (script should contain 1-2 self-asked questions using the creator's templates — skip this check only if qaPatterns was null/empty in the profile)
- No repetition-for-emphasis anywhere when the creator uses it (reproduce a repetitionPatterns RULE at least once — skip this check only if repetitionPatterns was null/empty)
- Direct address to camera missing when cameraFacingStyle.directAddressFrequency is non-"none" (the script should contain "you/your/aap" forms — skip this check only if cameraFacingStyle was null)
- Spoken-grammar divergences missing when spokenGrammar.droppedSubjects / droppedArticles / conjunctionFronting are non-"never" / non-empty (if every sentence is grammatically complete and prose-perfect, you have over-polished)

Also verify the original checklist:
- Did the hook use the learned openingFormula?
- Does the body follow the learned storyStructure and emotionalCurve?
- Are signature words / phrases / transitions present naturally?
- Is the CTA an authentic learned formula (not generic)?
- Does the sentence rhythm match the learned pacingStyle and averageSentenceLengthWords?
- Are authority references / evidence used as the creator would?
- Is the language mix accurate ( Ratios in speakingStyle.spokenLanguage )?
- Are psychological triggers activated at natural points?

If ANY checklist item is missing or ANY anti-pattern is present, revise the script before returning. A script that fails the speech check is a failure even if all other scores are high.

FINAL RULES:
- styleMatch scores MUST be numbers 0-100. Score honestly — the score represents how closely this script matches the creator's actual speaking style. A script that reads like an article should score low on speechRhythm and sentenceStyle even if vocabulary and CTA match.
- ${confidenceInstruction}
- ${modeInstruction}
- All content must be specific to the recommended concept. Zero placeholders, zero filler — conversationalFillers are the only allowed "filler" and they must come from the profile.
- The fullScript must read like it was SPOKEN on camera, not written for a reader. Short punchy beats where the creator uses them. Fragments. Pauses. Repetition. The creator's exact language mix.`


    const userPrompt = `═══ CREATOR DNA PROFILE ═══

IDENTITY
  Persona: ${creatorStyle.creatorPersona || 'unknown'}
  Brand Voice: ${creatorStyle.brandVoice || 'unknown'}
  Audience: ${JSON.stringify(creatorStyle.audienceProfile || {})}
  Psychological Triggers: ${JSON.stringify(creatorStyle.psychologicalTriggers || [])}
  Emotional Level: ${creatorStyle.emotionalLevel || 'unknown'}
  Humor Level: ${creatorStyle.humorLevel || 'unknown'}

SPEECH ARCHITECTURE
  Opening Formula: ${creatorStyle.openingFormula || 'unknown'}
  Story Structure: ${JSON.stringify(creatorStyle.storyStructure || [])}
  Signature Patterns: ${JSON.stringify(creatorStyle.signaturePatterns || [])}
  CTA Formula: ${JSON.stringify(creatorStyle.ctaFormula || [])}

═══ SPEAKING STYLE (HIGHEST PRIORITY — apply these aggressively) ═══
${speakingStyleBlock || '  (no speakingStyle block — apply SPEECH-FIRST RULES conservatively)'}

VOICE DNA
${dnaBlock || '  (no speechDNA — working from legacy profile)'}

VOCABULARY
  Formality: ${creatorStyle.vocabulary?.formality ?? 'unknown'}
  Technicality: ${creatorStyle.vocabulary?.technicality ?? 'unknown'}
  Signature Words: ${JSON.stringify(creatorStyle.vocabulary?.signatureWords || [])}
  Recurring Phrases: ${JSON.stringify(creatorStyle.vocabulary?.recurringPhrases || [])}
  Favorite Transitions: ${JSON.stringify(creatorStyle.vocabulary?.favoriteTransitions || [])}
  Emphasis Words: ${JSON.stringify(creatorStyle.vocabulary?.emphasisWords || [])}

LANGUAGE MIX
  ${JSON.stringify(creatorStyle.languageMix || {})}

AUTHORITY & EVIDENCE
  Authority Style: ${JSON.stringify(creatorStyle.authorityStyle || [])}
  Evidence Style: ${JSON.stringify(creatorStyle.evidenceStyle || [])}

STYLE EXAMPLES (study the PATTERN, do NOT copy verbatim)
${examplesBlock || '  (no examples — working from legacy profile)'}

WRITING TONE: ${creatorStyle.writingTone || 'unknown'}
HOOK STYLE: ${creatorStyle.hookStyle || 'unknown'}
CTA STYLE: ${creatorStyle.ctaStyle || 'unknown'}
RETENTION TECHNIQUES: ${JSON.stringify(creatorStyle.retentionTechniques || [])}

CONFIDENCE: ${creatorStyle.styleConfidence?.overall ?? 'unknown'} (${creatorStyle.styleConfidence?.dataSource || 'unknown'})

═══ CHANNEL ═══
  Title: ${channel.title || '(unknown)'}
  Description: ${(channel.description || '(none)').substring(0, 300)}

═══ RECENT VIDEOS (reference) ═══
${topVideos.length
      ? topVideos.map((v, i) => `  ${i + 1}. "${v.title}" — ${v.views || 0} views`).join('\n')
      : '  (none)'}

═══ RECOMMENDED CONCEPT ═══
  title: ${recommendation.title || '(none)'}
  whyRecommended: ${recommendation.whyRecommend || '(none)'}
  predictedViews: ${recommendation.predictedViews || 'n/a'}
  opportunityScore: ${recommendation.opportunity ?? 'n/a'} / 100

MODE: ${mode}

Now follow Steps 1–6. Build the Voice Checklist, study the examples, draft in writer mode inside the scratchpad, transform via the transcriptionist's headphones, write the final output, verify against the checklist.`

    const cacheParams = {
      channelId,
      ideaId: recommendation.id,
      ideaTitle: recommendation.title,
      mode,
      _styleProfileVersion: ctx.styleProfileVersion || 1,
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

  // Scores how closely a given script matches the creator's Creator DNA profile.
  // Used by the editor to show a live Style Match panel.
  // The `styleMatch` shape is a superset of the v1 shape — overall + 6 existing
  // dimensions are unchanged (validator passes). 9 new diagnostic dimensions added.
  async scoreScriptStyle(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const script = ctx.script || {}
    const creatorStyle = ctx.creatorStyle || {}

    // Compact profile summary for the scoring prompt
    const profileSummary = {
      summary: creatorStyle.summary,
      creatorPersona: creatorStyle.creatorPersona,
      brandVoice: creatorStyle.brandVoice,
      audienceProfile: creatorStyle.audienceProfile,
      psychologicalTriggers: creatorStyle.psychologicalTriggers,
      openingFormula: creatorStyle.openingFormula,
      storyStructure: creatorStyle.storyStructure,
      humorLevel: creatorStyle.humorLevel,
      emotionalLevel: creatorStyle.emotionalLevel,
      languageMix: creatorStyle.languageMix,
      hookStyle: creatorStyle.hookStyle,
      ctaStyle: creatorStyle.ctaStyle,
      ctaFormula: creatorStyle.ctaFormula,
      writingTone: creatorStyle.writingTone,
      authorityStyle: creatorStyle.authorityStyle,
      evidenceStyle: creatorStyle.evidenceStyle,
      vocabulary: creatorStyle.vocabulary,
      signaturePatterns: creatorStyle.signaturePatterns,
      speechDNA: creatorStyle.speechDNA,
      retentionTechniques: creatorStyle.retentionTechniques,
    }

    const systemPrompt = `You are a strict voice-match auditor. Score how closely a given script imitates a specific creator's learned DNA profile. Be calibrated and honest — do not default to high scores.

Return ONLY valid JSON. Shape:
{
  "styleMatch": {
    "overall": <number 0-100, weighted average — weight hook, rhythm, and vocabulary most heavily>,
    "language": <number 0-100, how accurately the language mix (English/Hindi ratio) matches>,
    "hook": <number 0-100, does the hook match the learned openingFormula and hookStyle>,
    "flow": <number 0-100, does conversational flow match the creator's learned pattern>,
    "rhythm": <number 0-100, does sentence length and pacing match speechDNA.pacingStyle and averageSentenceLength>,
    "vocabulary": <number 0-100, are signatureWords, recurringPhrases, and transitions present naturally>,
    "retention": <number 0-100, are learned retentionTechniques and curiosityLoops present>,
    "persona": <number 0-100, does the narrator role and communication style match creatorPersona>,
    "authority": <number 0-100, are authority references (laws, stats, reports, etc.) used the way this creator would>,
    "storyStructure": <number 0-100, does the body follow the learned storyStructure order>,
    "psychologicalTriggers": <number 0-100, are the right psychological triggers activated at natural points>,
    "speechRhythm": <number 0-100, does question density, punchline frequency, and pause patterns match speechDNA>,
    "sentenceStyle": <number 0-100, does sentence complexity and short-vs-long ratio match speechDNA>,
    "examplesSimilarity": <number 0-100, do hook/CTA/transition patterns feel similar to the styleExamples>,
    "CTA": <number 0-100, does the CTA match the learned ctaFormula rather than being generic>,
    "languageMix": <number 0-100, same as language but focused on code-switch frequency precision>
  }
}

Scoring rules:
- overall is the PRIMARY score used by the frontend — weight it on hook (25%), rhythm (20%), vocabulary (20%), flow (15%), language (10%), retention (10%).
- Score each dimension independently against the profile signals.
- If a profile field is missing/unknown, skip that dimension's contribution (score it 50 as neutral).
- Never award 90+ unless the script genuinely sounds indistinguishable from the creator.`

    const userPrompt = `CREATOR DNA PROFILE
${JSON.stringify(profileSummary, null, 2)}

SCRIPT TO SCORE
  title: ${script.title || ''}
  hook: ${script.hook || ''}
  fullScript: ${(script.fullScript || '').substring(0, 3000)}
  cta: ${script.cta || ''}

Score all dimensions honestly now.`

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

  // ── Thumbnail Intelligence (Phase 3.1) ──────────────────────────────────
  //
  // analyzeThumbnailStyle — reverse-engineers a creator's thumbnail DNA from
  // their channel metadata, video titles, and performance data. The DNA is a
  // structured description of visual style (colors, typography, layout,
  // branding, emotion, clickbait intensity, consistency) that downstream
  // strategy generation uses to produce on-brand thumbnail concepts.
  //
  // Phase 3.1: DNA is AI-inferred from metadata. Phase 3.2+ can enrich with
  // real image analysis (color extraction, face detection, OCR) — the schema
  // already has slots for those fields.
  async analyzeThumbnailStyle(ctx = {}, _opts = {}) {
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

    const systemPrompt = `You are a thumbnail designer who reverse-engineers creators' visual style. Given a channel's recent video titles, view counts, and channel description, you produce a Thumbnail DNA Profile — a structured description of how this creator designs thumbnails.

The DNA is used downstream to generate on-brand thumbnail concepts and an editable generation prompt. Be specific and actionable — every field should help a designer or AI replicate the style.

Return ONLY valid JSON (no markdown fences). Shape:
{
  "summary": "<2-3 sentence plain-English description of this creator's thumbnail style>",
  "colors": {
    "primary": ["<2-3 named or hex colors>"],
    "accent": ["<1-2 highlight colors>"],
    "background": "<typical background color>"
  },
  "typography": {
    "style": "<one of: bold-sans | condensed-sans | serif | script | mixed>",
    "size": "<one of: small | medium | large | extra-large>",
    "position": "<one of: left | center | right | top | bottom | overlay>",
    "stroke": "<one of: none | thin-white | bold-white | black-stroke | colored-stroke>",
    "shadow": "<one of: none | soft-drop | hard-drop | glow | double>"
  },
  "layout": {
    "facePlacement": "<one of: none | left | right | center | inset-small | split-screen>",
    "textPosition": "<one of: left | right | center | top | bottom | overlay-full>",
    "composition": "<one of: face-plus-text | text-only | object-focus | split-screen | minimal>",
    "negativeSpace": "<one of: none | minimal | moderate | generous>",
    "visualClutter": "<one of: clean | balanced | busy | dense>"
  },
  "branding": {
    "logoPlacement": "<one of: none | corner | watermark | none>",
    "logoConsistency": <0-1>
  },
  "elements": {
    "arrows": <true|false>,
    "circles": <true|false>,
    "emojis": <true|false>,
    "objectHighlighting": <true|false>
  },
  "emotion": ["<2-4 emotions: shock | curiosity | urgency | excitement | anger | awe | fear | joy | confusion | intrigue>"],
  "clickbaitIntensity": <0-1>,
  "ctrStyle": "<one of: high-contrast | curiosity-gap | reaction-shot | bold-text | minimal-clean | numbered-list | comparison>",
  "visualHierarchy": "<one of: face-dominant | text-dominant | balanced | object-dominant>",
  "consistencyScore": <0-100>
}

Rules:
- Every 0-1 score and 0-100 score must be a number, not a string.
- Infer colors from the channel niche and title energy (e.g., gaming → red/black/yellow; finance → blue/green/white; beauty → pink/white/gold).
- Infer typography from title capitalization patterns (ALL CAPS → bold-sans; Title Case → medium serif/sans).
- Infer emotion from title sentiment (questions → curiosity; exclamation → excitement/urgency; numbers → intrigue).
- "consistencyScore" reflects how uniform the creator's thumbnail style appears across videos (100 = very consistent, 0 = random).
- Do not invent facts. If video data is sparse, mark fields "unknown" or null rather than guessing wildly.`

    const userPrompt = `CHANNEL
  Title: ${channel.title || '(unknown)'}
  Handle: ${channel.handle || '(none)'}
  Description: ${(channel.description || '(none provided)').substring(0, 800)}
  Subscribers: ${channel.subscribers || 0}
  Niche/Category: ${channel.category || channel.niche || '(unknown)'}

RECENT VIDEOS (top ${topVideos.length})
${topVideos.length
      ? topVideos.map((v, i) => `  ${i + 1}. "${v.title || '(untitled)'}" — ${v.views || 0} views, ${v.likes || 0} likes`).join('\n')
      : '  (no video data available — infer from niche and description)'}

Build the Thumbnail DNA Profile now.`

    return this._execute(
      'analyzeThumbnailStyle',
      { channelId },
      systemPrompt,
      userPrompt,
      { temperature: 0.5 },
    )
  }

  // generateThumbnailStrategy — produces 3-5 thumbnail concepts + an editable
  // generation prompt + a similarity breakdown, all grounded in the creator's
  // DNA, the current script, creator style, and recent performance.
  async generateThumbnailStrategy(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const script = ctx.script || {}
    const title = ctx.title || script?.title || ''
    const creatorStyle = ctx.creatorStyle || {}
    const thumbnailProfile = ctx.thumbnailProfile || {}
    const videos = Array.isArray(ctx.videos) ? ctx.videos : []
    const channel = ctx.channel || {}
    const regenerate = ctx.regenerate === true

    const topVideos = videos.slice(0, 8).map((v) => ({
      title: v.title,
      views: v.views,
    }))

    const systemPrompt = `You are a thumbnail strategist who designs click-optimized YouTube thumbnails that match a creator's established visual style. You are given:
1. A Thumbnail DNA Profile (the creator's visual style)
2. A Creator Style Profile (the creator's voice/tone)
3. The current script + title for the video
4. The channel's recent video titles + performance

Your job: produce 3-5 thumbnail concepts, each with a title, explanation, predicted CTR, and similarity to the creator's historical style. Plus an editable generation prompt that a designer or image AI can use. Plus a similarity breakdown comparing the concepts to the creator's DNA.

Return ONLY valid JSON (no markdown fences). Shape:
{
  "concepts": [
    {
      "id": "concept-1",
      "title": "<short label for this thumbnail concept, under 60 chars>",
      "explanation": "<1-2 sentence description of what the thumbnail shows>",
      "audienceReaction": "<1 sentence: what emotion/action this triggers in the viewer>",
      "whyItFits": "<1 sentence: why this matches the creator's style>",
      "predictedCTR": <number 0-20, e.g. 9.3 means 9.3%>,
      "similarity": <number 0-100>,
      "confidence": <number 0-100>
    }
  ],
  "prompt": "<a detailed, editable prompt for generating this thumbnail. Include style, composition, colors, text, emotion, layout. 4-8 sentences. This will be edited by the user and later sent to an image generator.>",
  "similarity": {
    "overall": <number 0-100>,
    "colors": <number 0-100>,
    "typography": <number 0-100>,
    "layout": <number 0-100>,
    "composition": <number 0-100>,
    "emotion": <number 0-100>,
    "branding": <number 0-100>,
    "textStyle": <number 0-100>,
    "visualIdentity": <number 0-100>
  }
}

Rules:
- Produce 3-5 concepts. Each must have a distinct angle (e.g., curiosity-gap, reaction-shot, bold-text, comparison, minimal).
- predictedCTR must be a number (e.g., 8.5 for 8.5%). Base it on the creator's historical performance and the concept's alignment with their style.
- similarity (per concept) = how closely this concept matches the creator's DNA (0-100).
- confidence = how sure you are this concept will perform (0-100).
- The prompt must be specific enough to generate a thumbnail: mention colors, text style, face/expression, layout, background, emotion. Use the DNA's language.
- The similarity breakdown compares the overall strategy (concepts + prompt) against the creator's DNA.
- All scores must be numbers, not strings.
- Do not reference image generation APIs. The prompt is a text description.`

    const userPrompt = `THUMBNAIL DNA PROFILE
${JSON.stringify(thumbnailProfile, null, 2)}

CREATOR STYLE PROFILE
${JSON.stringify(creatorStyle, null, 2)}

CHANNEL
  Title: ${channel.title || '(unknown)'}
  Niche: ${channel.category || channel.niche || '(unknown)'}

RECENT VIDEOS (top ${topVideos.length})
${topVideos.length
      ? topVideos.map((v, i) => `  ${i + 1}. "${v.title}" — ${v.views || 0} views`).join('\n')
      : '  (none)'}

CURRENT SCRIPT
  Title: ${title}
  Hook: ${script?.hook || '(none)'}
  Full script (truncated): ${(script?.fullScript || '').slice(0, 2000)}
  CTA: ${script?.cta || '(none)'}

${regenerate ? 'REGENERATE: produce fresh concepts, different from any prior attempt.' : 'Generate the thumbnail strategy now.'}`

    const cacheParams = {
      channelId,
      ideaId: ctx.ideaId || '',
      ideaTitle: title,
      scriptHash: `${title}::${(script?.fullScript || '').length}`,
    }
    if (regenerate) {
      cacheParams.regenAt = ctx.regenAt || Date.now()
    }

    return this._execute(
      'generateThumbnailStrategy',
      cacheParams,
      systemPrompt,
      userPrompt,
      { temperature: regenerate ? 0.9 : 0.7 },
    )
  }

  // scoreThumbnailSimilarity — cheap re-score pass on the current strategy's
  // similarity breakdown. Used after the user edits the prompt, so the
  // similarity reflects the edited prompt vs the creator's DNA. Does NOT
  // re-generate concepts.
  async scoreThumbnailSimilarity(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const strategy = ctx.strategy || {}
    const thumbnailProfile = ctx.thumbnailProfile || {}

    const systemPrompt = `You are a thumbnail style analyst. Given a thumbnail strategy (concepts + prompt) and a creator's Thumbnail DNA Profile, produce a similarity breakdown comparing the strategy against the DNA.

Return ONLY valid JSON (no markdown fences). Shape:
{
  "similarity": {
    "overall": <number 0-100>,
    "colors": <number 0-100>,
    "typography": <number 0-100>,
    "layout": <number 0-100>,
    "composition": <number 0-100>,
    "emotion": <number 0-100>,
    "branding": <number 0-100>,
    "textStyle": <number 0-100>,
    "visualIdentity": <number 0-100>
  }
}

Rules:
- All scores must be numbers 0-100.
- Compare the strategy's prompt + concepts against the DNA's colors, typography, layout, branding, emotion.
- "overall" is a weighted average, not a simple mean — weight visualIdentity and colors highest.
- If the prompt was edited to deviate from the DNA, score lower. If it aligns, score higher.`

    const userPrompt = `THUMBNAIL DNA PROFILE
${JSON.stringify(thumbnailProfile, null, 2)}

CURRENT STRATEGY
  Prompt: ${strategy.prompt || '(empty)'}
  Concepts: ${(strategy.concepts || []).length} concept(s)
${(strategy.concepts || []).slice(0, 3).map((c, i) => `    ${i + 1}. "${c.title}" — CTR ${c.predictedCTR}%`).join('\n')}

Produce the similarity breakdown now.`

    return this._execute(
      'scoreThumbnailSimilarity',
      {
        channelId,
        promptHash: `${(strategy.prompt || '').length}::${(strategy.concepts || []).length}`,
        profileId: ctx.profileId || '',
      },
      systemPrompt,
      userPrompt,
      { temperature: 0.3 },
    )
  }
}
