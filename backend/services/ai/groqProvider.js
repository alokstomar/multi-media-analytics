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
}

