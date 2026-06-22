import OpenAI from 'openai'
import { OpenAIProvider } from './openaiProvider.js'

// Groq serves an OpenAI-compatible Chat Completions API, so we reuse the
// entire OpenAIProvider pipeline (cache, budget, validators, prompts, vision
// payload shape) and only override the constructor: swap the baseURL, change
// the default models to Llama 3, and re-skin the provider labels used in
// logs / cache entries / healthCheck so Groq runs are distinguishable.
//
// Cost-estimation caveat: OpenAIProvider calls a module-level estimateCost()
// that looks up OpenAI's MODEL_PRICING table. Groq model names won't match,
// so entries will fall back to gpt-4o-mini pricing — under-reporting premium
// Llama spend. AIUsageLog entries remain valid for trend tracking; only
// absolute $ figures are approximate. Fixable later by promoting
// estimateCost to an instance method if needed.

export class GroqProvider extends OpenAIProvider {
  constructor(apiKey) {
    super(apiKey)

    // Rebind the OpenAI SDK client to Groq's OpenAI-compatible endpoint.
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })

    // Groq model defaults — env overrides still respected per-environment.
    this.fastModel = process.env.GROQ_FAST_MODEL || 'llama-3.1-8b-instant'
    this.premiumModel = process.env.GROQ_PREMIUM_MODEL || 'llama-3.3-70b-versatile'

    // Budget gates (separate from OpenAI's so operators can cap Groq spend).
    this.dailyBudget = parseFloat(process.env.GROQ_DAILY_BUDGET_USD) || Infinity
    this.monthlyBudget = parseFloat(process.env.GROQ_MONTHLY_BUDGET_USD) || Infinity

    // Labels — distinguish Groq runs in AIResponseCache.provider and logs.
    this.providerKey = 'groq'
    this.providerLabel = 'Groq'
    this.logPrefix = '[AI Groq]'
  }

  // ── Portfolio Intelligence (multi-channel aggregates) ────────────────
  // Each method takes ctx.channels = [{ channel: ChannelDoc, videos: VideoDoc[] }]
  // from portfolioController.loadPortfolioContext. We serialize to a compact
  // prompt, let Llama produce JSON, then _execute validates + caches. On any
  // failure (parse error, validation error, network), the proxy in index.js
  // falls back to the deterministic stub.

  _summarizeChannels(channels) {
    return (channels || []).map((entry, i) => {
      const ch = entry.channel || entry
      const videos = entry.videos || []
      const topVideos = videos.slice(0, 5).map(v => ({
        title: (v.title || '').slice(0, 80),
        views: Number(v.views || 0),
        likes: Number(v.likes || 0),
        comments: Number(v.comments || 0),
      }))
      const avgViews = ch.totalVideos > 0 ? Math.round(ch.totalViews / ch.totalVideos) : 0
      const engagementRate = avgViews > 0 && videos.length > 0
        ? Number((videos.reduce((s, v) => s + (v.likes || 0) + (v.comments || 0), 0) / videos.reduce((s, v) => s + (v.views || 0), 1) * 100).toFixed(2))
        : 3.5
      return {
        id: i + 1,
        channelId: ch.channelId || ch.id || `ch-${i}`,
        name: ch.title || ch.name || `Channel ${i + 1}`,
        subscribers: Number(ch.subscribers || 0),
        totalViews: Number(ch.totalViews || 0),
        totalVideos: Number(ch.totalVideos || 0),
        avgViewsPerVideo: avgViews,
        engagementRate,
        description: (ch.description || '').slice(0, 200),
        topVideos,
      }
    })
  }

  async getPortfolioStrategist(ctx = {}, opts = {}) {
    const channels = this._summarizeChannels(ctx.channels)
    if (channels.length === 0) {
      return {
        healthScore: 0, stabilityScore: 0, riskLevel: 'Low',
        riskBadgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-100/50',
        growthMomentum: '+0%', bestPerformingCh: null, fastestGrowingCh: null,
        highestEngagementCh: null, highestRevenueCh: null, mostConsistentCh: null,
        subConcentration: 0, viewConcentration: 0, revenueDependency: 0,
        audienceDiversification: 0, recommendations: [], actionCenter: [], growthRadar: [],
      }
    }

    const systemPrompt = `You are a Chief Strategy Officer for a multi-channel YouTube portfolio. Analyze portfolio health, concentration risk, and growth momentum. Return ONLY valid JSON with this exact structure:
{
  "healthScore": <number 0-100>,
  "stabilityScore": <number 0-100>,
  "riskLevel": "Low" | "Moderate" | "High",
  "riskBadgeColor": "text-emerald-600 bg-emerald-50 border-emerald-100/50" | "text-amber-500 bg-amber-50 border-amber-100/50" | "text-red-500 bg-red-50 border-red-100/50",
  "growthMomentum": "+X%" or "-X%",
  "bestPerformingCh": { "id": <number>, "name": <string>, "color": "#8B5CF6" },
  "fastestGrowingCh": { "id": <number>, "name": <string>, "color": "#3B82F6" },
  "highestEngagementCh": { "id": <number>, "name": <string>, "color": "#10B981" },
  "highestRevenueCh": { "id": <number>, "name": <string>, "color": "#F59E0B" },
  "mostConsistentCh": { "id": <number>, "name": <string>, "color": "#8B5CF6" },
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

    const userPrompt = `Analyze this YouTube portfolio (${channels.length} channels):

${JSON.stringify(channels, null, 2)}

Return the JSON portfolio strategy report.`

    return this._execute('getPortfolioStrategist',
      { channelIds: channels.map(c => c.channelId) },
      systemPrompt, userPrompt, { temperature: 0.4 })
  }

  async getAudienceOverlap(ctx = {}, opts = {}) {
    const channels = this._summarizeChannels(ctx.channels)
    if (channels.length < 2) return { pairs: [], radarData: [] }

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

    const userPrompt = `Analyze audience overlap for these ${channels.length} channels:

${JSON.stringify(channels, null, 2)}`

    return this._execute('getAudienceOverlap',
      { channelIds: channels.map(c => c.channelId) },
      systemPrompt, userPrompt, { temperature: 0.4 })
  }

  async getPortfolioContentGaps(ctx = {}, opts = {}) {
    const channels = this._summarizeChannels(ctx.channels)
    if (channels.length === 0) return { gaps: [] }

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

    const userPrompt = `Find content gaps for this portfolio:

${JSON.stringify(channels, null, 2)}`

    return this._execute('getPortfolioContentGaps',
      { channelIds: channels.map(c => c.channelId) },
      systemPrompt, userPrompt, { temperature: 0.5 })
  }

  async getCannibalization(ctx = {}, opts = {}) {
    const channels = this._summarizeChannels(ctx.channels)
    if (channels.length < 2) return { warnings: [] }

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

    const userPrompt = `Detect cannibalization in this portfolio:

${JSON.stringify(channels, null, 2)}`

    return this._execute('getCannibalization',
      { channelIds: channels.map(c => c.channelId) },
      systemPrompt, userPrompt, { temperature: 0.4 })
  }

  async getCrossPromotion(ctx = {}, opts = {}) {
    const channels = this._summarizeChannels(ctx.channels)
    if (channels.length < 2) return { promotions: [] }

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

    const userPrompt = `Recommend cross-promotions for this portfolio:

${JSON.stringify(channels, null, 2)}`

    return this._execute('getCrossPromotion',
      { channelIds: channels.map(c => c.channelId) },
      systemPrompt, userPrompt, { temperature: 0.6 })
  }

  async getPortfolioSummary(ctx = {}, opts = {}) {
    const channels = this._summarizeChannels(ctx.channels)
    if (channels.length === 0) return { channelsCount: 0, channels: [] }

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

    const userPrompt = `Summarize this YouTube portfolio:

${JSON.stringify(channels, null, 2)}`

    return this._execute('getPortfolioSummary',
      { channelIds: channels.map(c => c.channelId) },
      systemPrompt, userPrompt, { temperature: 0.3 })
  }
}

