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
  repurposeContent: 24
}

// ── Model tier: which methods get the premium model ─────────────────────
const PREMIUM_METHODS = new Set([
  'generateThoughtLeadership',
  'repurposeContent',
  'analyzeLinkedInPost',
  'analyzeTweet'
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
  }
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
  }

  // ── Core execution pipeline ───────────────────────────────────────────

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
      throw new Error(`OpenAI daily budget exceeded ($${dailySpend.toFixed(4)} / $${this.dailyBudget})`)
    }
    if (monthlySpend >= this.monthlyBudget) {
      throw new Error(`OpenAI monthly budget exceeded ($${monthlySpend.toFixed(4)} / $${this.monthlyBudget})`)
    }
  }

  async _execute(method, params, systemPrompt, userPrompt) {
    if (!this.apiKey) throw new Error('OpenAI API Key not configured')

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
    const model = this._getModel(method)
    const startTime = Date.now()

    const completion = await this.client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8
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
        error: 'Invalid JSON structure from OpenAI',
        cacheHit: false, params
      }).catch(() => {})
      throw new Error(`OpenAI returned invalid JSON structure for ${method}`)
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
          provider: 'openai',
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

    console.log(`[AI OpenAI] ${method} — ${model} — ${totalTokens} tokens — $${cost.toFixed(6)} — ${responseTimeMs}ms`)
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
}
