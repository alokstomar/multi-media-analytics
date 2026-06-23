import { createHash } from 'crypto'
import OpenAI from 'openai'
import { AIProviderInterface } from './providerInterface.js'
import AIResponseCache from '../../models/AIResponseCache.js'
import AIUsageLog from '../../models/AIUsageLog.js'

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
  generateVideoIdeas: 12,
  generateShortsIdeas: 12,
  getStrategistTips: 6,
  getContentGaps: 12,
  summarizeAlerts: 6,
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
])

// ── Cost per 1M tokens (USD) for estimating spend ───────────────────────
const MODEL_PRICING = {
  'gpt-4o-mini':  { input: 0.15,  output: 0.60 },
  'gpt-4o':       { input: 2.50,  output: 10.00 },
  'gpt-4-turbo':  { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo':{ input: 0.50,  output: 1.50 }
}

function estimateCost(model, promptTokens, completionTokens) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4o-mini']
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000
}

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
}


export class OpenAIProvider extends AIProviderInterface {
  constructor(apiKey) {
    super()
    this.apiKey = apiKey
    this.client = new OpenAI({ apiKey })
    this.fastModel = process.env.OPENAI_FAST_MODEL || 'gpt-4o-mini'
    this.premiumModel = process.env.OPENAI_PREMIUM_MODEL || 'gpt-4o'
    this.dailyBudget = parseFloat(process.env.OPENAI_DAILY_BUDGET_USD) || Infinity
    this.monthlyBudget = parseFloat(process.env.OPENAI_MONTHLY_BUDGET_USD) || Infinity
    // Subclass hooks: keep these as instance fields so GroqProvider (or any
    // other OpenAI-compatible provider) can override them in its constructor
    // without duplicating _execute / analyzeThumbnail / _checkBudget.
    this.providerKey = 'openai'         // stored on AIResponseCache.provider
    this.providerLabel = 'OpenAI'       // used in error messages
    this.logPrefix = '[AI OpenAI]'      // used in console.log success lines
  }

  // ── Core execution pipeline ───────────────────────────────────────────

  async healthCheck() {
    return {
      provider: this.providerKey,
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

  async _checkBudget() {
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

    const cacheKey = makeCacheKey(method, params)

    // 1. Check cache
    try {
      const cached = await AIResponseCache.findOne({ cacheKey })
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
          params
        }).catch(() => {})  // fire-and-forget
        console.log(`[AI Cache HIT] ${method} — returning cached response`)
        return cached.response
      }
    } catch (cacheErr) {
      console.warn('[AI Cache] Read error:', cacheErr.message)
    }

    // 2. Check budget
    await this._checkBudget()

    // 3. Call OpenAI
    const model = options.model || this._getModel(method)
    const temperature = options.temperature ?? 0.8
    const startTime = Date.now()

    // userContent may be a string (text-only) or an array (vision: text + image_url).
    const userContent = options.userContent || userPrompt

    const completion = await this.client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature
    })

    const responseTimeMs = Date.now() - startTime
    const rawContent = completion.choices?.[0]?.message?.content || '{}'
    const usage = completion.usage || {}
    const promptTokens = usage.prompt_tokens || 0
    const completionTokens = usage.completion_tokens || 0
    const totalTokens = usage.total_tokens || promptTokens + completionTokens
    const cost = estimateCost(model, promptTokens, completionTokens)

    // 4. Parse and validate JSON
    const parsed = parseJSON(rawContent)
    const validator = VALIDATORS[method]

    if (!parsed || (validator && !validator(parsed))) {
      // Log the failed parse attempt
      AIUsageLog.create({
        method, model, promptTokens, completionTokens, totalTokens,
        estimatedCost: cost, responseTimeMs,
        success: false,
        error: `Invalid JSON structure from ${this.providerLabel}`,
        cacheHit: false, params
      }).catch(() => {})
      throw new Error(`${this.providerLabel} returned invalid JSON structure for ${method}`)
    }

    // 5. Cache response
    const ttlHours = CACHE_TTL[method] || 24
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)
    try {
      await AIResponseCache.findOneAndUpdate(
        { cacheKey },
        {
          cacheKey, method, params,
          response: parsed,
          provider: this.providerKey,
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
      success: true, cacheHit: false, params
    }).catch(() => {})

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
    if (!this.apiKey) throw new Error(`${this.providerLabel} API Key not configured`)
    const imageDataUrl = payload.imageBase64 || payload.imageDataUrl
    if (!imageDataUrl) throw new Error('analyzeThumbnail requires imageBase64')

    // Hash the image so cache keys stay small.
    const imageHash = createHash('sha256').update(imageDataUrl).digest('hex').substring(0, 32)
    const cacheKey = makeCacheKey('analyzeThumbnail', { imageHash })

    // Cache check
    try {
      const cached = await AIResponseCache.findOne({ cacheKey })
      if (cached) {
        AIUsageLog.create({
          method: 'analyzeThumbnail',
          model: cached.usage?.model || this.premiumModel,
          promptTokens: 0, completionTokens: 0, totalTokens: 0,
          estimatedCost: 0, responseTimeMs: 0,
          success: true, cacheHit: true, params: { imageHash }
        }).catch(() => {})
        console.log('[AI Cache HIT] analyzeThumbnail — returning cached response')
        return cached.response
      }
    } catch (cacheErr) {
      console.warn('[AI Cache] Read error:', cacheErr.message)
    }

    await this._checkBudget()

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

    const completion = await this.client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
    })

    const responseTimeMs = Date.now() - startTime
    const rawContent = completion.choices?.[0]?.message?.content || '{}'
    const usage = completion.usage || {}
    const promptTokens = usage.prompt_tokens || 0
    const completionTokens = usage.completion_tokens || 0
    const totalTokens = usage.total_tokens || promptTokens + completionTokens
    const cost = estimateCost(model, promptTokens, completionTokens)

    const parsed = parseJSON(rawContent)
    if (!parsed || !VALIDATORS.analyzeThumbnail(parsed)) {
      AIUsageLog.create({
        method: 'analyzeThumbnail', model, promptTokens, completionTokens, totalTokens,
        estimatedCost: cost, responseTimeMs,
        success: false, error: `Invalid JSON structure from ${this.providerLabel}`,
        cacheHit: false, params: { imageHash }
      }).catch(() => {})
      throw new Error(`${this.providerLabel} returned invalid JSON structure for analyzeThumbnail`)
    }

    // Cache + log
    const expiresAt = new Date(Date.now() + (CACHE_TTL.analyzeThumbnail || 48) * 60 * 60 * 1000)
    try {
      await AIResponseCache.findOneAndUpdate(
        { cacheKey },
        {
          cacheKey, method: 'analyzeThumbnail', params: { imageHash },
          response: parsed, provider: this.providerKey,
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
      success: true, cacheHit: false, params: { imageHash }
    }).catch(() => {})

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
}
