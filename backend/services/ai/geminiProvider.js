import { createHash } from 'crypto'
import { GoogleGenAI } from '@google/genai'
import { AIProviderInterface } from './providerInterface.js'
import AIResponseCache from '../../models/AIResponseCache.js'
import AIUsageLog from '../../models/AIUsageLog.js'
import { aiLocalStorage } from '../../utils/aiContext.js'
import { calculateCost } from '../../utils/aiPricing.js'
import { checkUserBudget, incrementUserUsage } from '../../utils/aiUsage.js'

// ── Per-method cache TTL configuration (hours) ──────────────────────────
// Mirrors openaiProvider.js — same TTLs so cache behavior is identical
// regardless of which provider is active.
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
  generateCompetitorOpportunities: 24
}

// ── Model tier: which methods get the premium model ─────────────────────
// Identical to openaiProvider.js — keeps cross-provider parity.
const PREMIUM_METHODS = new Set([
  'generateThoughtLeadership',
  'repurposeContent',
  'analyzeLinkedInPost',
  'analyzeTweet',
  'analyzeThumbnail', // vision → premium model
])

function makeCacheKey(method, params) {
  const raw = method + '::' + JSON.stringify(params)
  return createHash('sha256').update(raw).digest('hex')
}

// ── Safely parse JSON from Gemini response, with fallback ───────────────
// Gemini's JSON mode is reliable but occasionally wraps output in markdown
// fences or trailing commentary — strip both before JSON.parse.
function parseJSON(text) {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

// ── Validators: identical to openaiProvider — frontend shape contracts ──
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
  }
}

// ── Split a data URL ("data:image/png;base64,XXX") into mimeType + raw ──
// Gemini's inlineData needs raw base64 (no data: prefix).
function splitDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '')
  if (!match) return { mimeType: 'image/png', data: dataUrl || '' }
  return { mimeType: match[1], data: match[2] }
}

export class GeminiProvider extends AIProviderInterface {
  constructor(apiKey) {
    super()
    this.apiKey = apiKey
    this.client = new GoogleGenAI({ apiKey })
    this.fastModel = process.env.GEMINI_FAST_MODEL || 'gemini-2.0-flash'
    this.premiumModel = process.env.GEMINI_PREMIUM_MODEL || 'gemini-2.5-pro'
    this.dailyBudget = parseFloat(process.env.GEMINI_DAILY_BUDGET_USD) || Infinity
    this.monthlyBudget = parseFloat(process.env.GEMINI_MONTHLY_BUDGET_USD) || Infinity
  }

  // ── Core execution pipeline ───────────────────────────────────────────

  async healthCheck() {
    return {
      provider: 'gemini',
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
      throw new Error(`Gemini daily budget exceeded ($${dailySpend.toFixed(4)} / $${this.dailyBudget})`)
    }
    if (monthlySpend >= this.monthlyBudget) {
      throw new Error(`Gemini monthly budget exceeded ($${monthlySpend.toFixed(4)} / $${this.monthlyBudget})`)
    }
  }

  async _execute(method, params, systemPrompt, userPrompt, options = {}) {
    if (!this.apiKey) throw new Error('Gemini API Key not configured')

    const store = aiLocalStorage.getStore()
    const userId = store?.userId
    const cacheKey = makeCacheKey(method, params)

    // 1. Check cache (same shape as OpenAI provider — same AIResponseCache collection)
    try {
      const cached = userId
        ? await AIResponseCache.findOne({ cacheKey, userId })
        : await AIResponseCache.findOne({ cacheKey })
      if (cached) {
        AIUsageLog.create({
          method,
          model: cached.usage?.model || this.fastModel,
          promptTokens: 0, completionTokens: 0, totalTokens: 0,
          estimatedCost: 0, responseTimeMs: 0,
          success: true, cacheHit: true, params,
          userId,
          provider: 'gemini'
        }).catch(() => {})

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

    // 3. Call Gemini
    const model = options.model || this._getModel(method)
    const temperature = options.temperature ?? 0.8
    const startTime = Date.now()

    // userContent may be a string (text-only) or an array of Part objects
    // (vision: text + inlineData). Gemini accepts both via `contents`.
    const userContent = options.userContent || userPrompt

    const response = await this.client.models.generateContent({
      model,
      contents: userContent,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        temperature,
      },
    })

    const responseTimeMs = Date.now() - startTime
    const rawContent = response.text || '{}'

    // Normalize Gemini usage metadata to OpenAI-like field names so
    // AIUsageLog stays schema-stable across providers.
    const usage = response.usageMetadata || {}
    const promptTokens = usage.promptTokenCount || 0
    const completionTokens = usage.candidatesTokenCount || 0
    const totalTokens = usage.totalTokenCount || promptTokens + completionTokens
    const cost = calculateCost({ provider: 'gemini', model, promptTokens, completionTokens })

    // 4. Parse and validate JSON
    const parsed = parseJSON(rawContent)
    const validator = VALIDATORS[method]

    if (!parsed || (validator && !validator(parsed))) {
      AIUsageLog.create({
        method, model, promptTokens, completionTokens, totalTokens,
        estimatedCost: cost, responseTimeMs,
        success: false, error: 'Invalid JSON structure from Gemini',
        cacheHit: false, params,
        userId,
        provider: 'gemini'
      }).catch(() => {})
      throw new Error(`Gemini returned invalid JSON structure for ${method}`)
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
          provider: 'gemini',
          userId,
          usage: { promptTokens, completionTokens, totalTokens, model, estimatedCost: cost },
          responseTimeMs, expiresAt
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
      provider: 'gemini'
    }).catch(() => {})

    if (userId) {
      await incrementUserUsage(userId, { spend: cost, tokens: totalTokens, cacheHit: false })
    }

    console.log(`[AI Gemini] ${method} — ${model} — ${totalTokens} tokens — $${cost.toFixed(6)} — ${responseTimeMs}ms`)
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
Return ONLY valid JSON as an array with this structure:
[
  {"id": "1", "title": "content idea title", "impact": "High|Medium|Viral"},
  {"id": "2", "title": "another idea", "impact": "High|Medium|Viral"}
]
Generate 5-8 unique, timely ideas.`

    const userPrompt = `Generate trending content ideas for the category: "${category}"
Focus on current trends in 2026. Make them specific and actionable.`

    return this._execute('generateContentIdeas', { category }, systemPrompt, userPrompt)
  }

  async findTrendingTopics(category) {
    const systemPrompt = `You are a trend analyst. Identify currently trending topics in the given category.
Return ONLY valid JSON as an array with this structure:
[
  {"topic": "topic name", "trendScore": <number 70-100>, "growth": <number like 84.5>, "competition": "Low|Medium|High", "opportunityScore": <number 70-100>}
]
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
Return ONLY valid JSON as an array with this structure:
[
  {"trendName": "trend name", "growth": <number like 84.5>, "opportunityScore": <number 70-100>, "suggestedAngle": "content angle suggestion"}
]
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

  async analyzeThumbnail(payload = {}) {
    if (!this.apiKey) throw new Error('Gemini API Key not configured')
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
          success: true, cacheHit: true, params: { imageHash },
          userId,
          provider: 'gemini'
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

    const model = this.premiumModel // gemini-2.5-pro supports vision
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

    // Gemini vision: split the data URL into raw base64 + mimeType.
    const { mimeType, data: imageBase64 } = splitDataUrl(imageDataUrl)

    let response
    try {
      console.log(`[AI Gemini] Executing analyzeThumbnail vision call using model: ${model}`)
      response = await this.client.models.generateContent({
        model,
        contents: [
          { text: 'Analyze this YouTube thumbnail and predict its CTR performance.' },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      })
    } catch (apiErr) {
      console.error(`[AI Gemini] Error during Gemini Vision API execution:`, apiErr)
      throw apiErr
    }

    const responseTimeMs = Date.now() - startTime
    const rawContent = response.text || '{}'
    const usage = response.usageMetadata || {}
    const promptTokens = usage.promptTokenCount || 0
    const completionTokens = usage.candidatesTokenCount || 0
    const totalTokens = usage.totalTokenCount || promptTokens + completionTokens
    const cost = calculateCost({ provider: 'gemini', model, promptTokens, completionTokens })

    const parsed = parseJSON(rawContent)
    if (!parsed || !VALIDATORS.analyzeThumbnail(parsed)) {
      AIUsageLog.create({
        method: 'analyzeThumbnail', model, promptTokens, completionTokens, totalTokens,
        estimatedCost: cost, responseTimeMs,
        success: false, error: 'Invalid JSON structure from Gemini',
        cacheHit: false, params: { imageHash },
        userId,
        provider: 'gemini'
      }).catch(() => {})
      throw new Error('Gemini returned invalid JSON structure for analyzeThumbnail')
    }

    // Cache + log
    const expiresAt = new Date(Date.now() + (CACHE_TTL.analyzeThumbnail || 48) * 60 * 60 * 1000)
    try {
      await AIResponseCache.findOneAndUpdate(
        userId ? { cacheKey, userId } : { cacheKey },
        {
          cacheKey, method: 'analyzeThumbnail', params: { imageHash },
          response: parsed, provider: 'gemini',
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
      success: true, cacheHit: false, params: { imageHash },
      userId,
      provider: 'gemini'
    }).catch(() => {})

    if (userId) {
      await incrementUserUsage(userId, { spend: cost, tokens: totalTokens, cacheHit: false })
    }

    console.log(`[AI Gemini] analyzeThumbnail — ${model} — ${totalTokens} tokens — $${cost.toFixed(6)} — ${responseTimeMs}ms`)
    return parsed
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
      return await this._execute(
        'analyzeScript',
        { script: script.substring(0, 2000) },
        systemPrompt,
        userPrompt,
        { temperature: 0.6 }
      )
    } catch (error) {
      console.error('Script Analysis Error:', error)
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
        if (!this.apiKey) throw new Error('Gemini API Key not configured')
        const store = aiLocalStorage.getStore()
        const userId = store?.userId

        await this._checkBudget(userId)

        const model = this.premiumModel
        const startTime = Date.now()

        console.log(`[AI Gemini] Executing simulatePerformance (vision call) using model: ${model}`)
        
        const { mimeType, data: imageBase64 } = splitDataUrl(thumbnail)

        const response = await this.client.models.generateContent({
          model,
          contents: [
            { text: userPrompt },
            { inlineData: { mimeType, data: imageBase64 } }
          ],
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            temperature: 0.5
          }
        })

        const responseTimeMs = Date.now() - startTime
        const rawContent = response.text || '{}'
        const usage = response.usageMetadata || {}
        const promptTokens = usage.promptTokenCount || 0
        const completionTokens = usage.candidatesTokenCount || 0
        const totalTokens = usage.totalTokenCount || promptTokens + completionTokens
        const cost = calculateCost({ provider: 'gemini', model, promptTokens, completionTokens })

        const parsed = parseJSON(rawContent)
        if (!parsed || !VALIDATORS.simulatePerformance(parsed)) {
          AIUsageLog.create({
            method: 'simulatePerformance', model, promptTokens, completionTokens, totalTokens,
            estimatedCost: cost, responseTimeMs,
            success: false, error: 'Invalid JSON structure from Gemini',
            cacheHit: false, params: { title, duration, scriptLength: script.length, hasThumbnail: true },
            userId, provider: 'gemini'
          }).catch(() => {})
          throw new Error('Gemini returned invalid JSON structure for simulatePerformance')
        }

        const expiresAt = new Date(Date.now() + (CACHE_TTL.simulatePerformance || 48) * 60 * 60 * 1000)
        try {
          const params = { title, duration, scriptLength: script.length, hasThumbnail: true }
          const cacheKey = makeCacheKey('simulatePerformance', params)
          await AIResponseCache.findOneAndUpdate(
            userId ? { cacheKey, userId } : { cacheKey },
            {
              cacheKey, method: 'simulatePerformance', params,
              response: parsed, provider: 'gemini',
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
          method: 'simulatePerformance', model, promptTokens, completionTokens, totalTokens,
          estimatedCost: cost, responseTimeMs,
          success: true, cacheHit: false, params: { title, duration, scriptLength: script.length, hasThumbnail: true },
          userId, provider: 'gemini'
        }).catch(() => {})

        if (userId) {
          await incrementUserUsage(userId, { spend: cost, tokens: totalTokens, cacheHit: false })
        }

        console.log(`[AI Gemini] simulatePerformance (vision) — ${model} — ${totalTokens} tokens — $${cost.toFixed(6)} — ${responseTimeMs}ms`)
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

  async getStrategistTips(ctx = {}, _opts = {}) {
    const channelId = ctx.channelId || ''
    const channel = ctx.channel || {}
    const videos = Array.isArray(ctx.videos) ? ctx.videos : []

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

    return this._execute(
      'generateCompetitorOpportunities',
      { channelId: payload.channelId || 'unknown' },
      systemPrompt,
      userPrompt,
      { temperature: 0.7 }
    )
  }
}
