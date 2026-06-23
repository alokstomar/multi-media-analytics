import { StubAIProvider } from './stubProvider.js'
import { OpenAIProvider } from './openaiProvider.js'
import { GeminiProvider } from './geminiProvider.js'
import { GroqProvider } from './groqProvider.js'
import { AIProviderError } from './AIProviderError.js'

const providerType = process.env.AI_PROVIDER || 'stub'
const openaiApiKey = process.env.OPENAI_API_KEY
const geminiApiKey = process.env.GEMINI_API_KEY
const groqApiKey = process.env.GROQ_API_KEY

// Shared method list — kept identical across providers so the production proxy
// can wrap each one uniformly.
const PROVIDER_METHOD_NAMES = [
  'healthCheck',
  'generateTweet', 'generateThread', 'analyzeTweet',
  'generateContentIdeas', 'findTrendingTopics',
  'generateLinkedInPost', 'generateThoughtLeadership',
  'analyzeLinkedInPost', 'discoverIndustryTrends', 'repurposeContent',
  // Priority 1 — YouTube Content Intelligence
  'analyzeTitle', 'analyzeThumbnail',
  'generateVideoIdeas', 'generateShortsIdeas',
  'getStrategistTips', 'getContentGaps', 'summarizeAlerts',
  // Portfolio Intelligence
  'getPortfolioSummary', 'getAudienceOverlap', 'getCrossPromotion',
  'getPortfolioContentGaps', 'getCannibalization', 'getPortfolioStrategist',
]

/**
 * Production proxy. Never falls back to stub. Any provider error — network
 * failure, rate limit, invalid key, missing method, malformed response — is
 * re-thrown as an AIProviderError so the error handler can return a clean
 * 503 with `aiUnavailable: true`. The stub provider is unreachable through
 * this proxy; it exists only for explicit AI_PROVIDER=stub dev/test mode.
 */
function buildProductionProxy(primaryProvider, providerLabel, defaultModel) {
  const proxy = {}
  for (const name of PROVIDER_METHOD_NAMES) {
    proxy[name] = async function (...args) {
      if (typeof primaryProvider[name] !== 'function') {
        throw new AIProviderError({
          provider: providerLabel,
          method: name,
          model: defaultModel,
          cause: new Error(`Method "${name}" not implemented on ${providerLabel} provider`),
        })
      }
      try {
        return await primaryProvider[name](...args)
      } catch (err) {
        if (err instanceof AIProviderError) throw err
        throw new AIProviderError({
          provider: providerLabel,
          method: name,
          model: defaultModel,
          cause: err,
        })
      }
    }
  }
  return proxy
}

let activeProviderInstance
let activeProviderLabel = 'stub'
const stubProvider = new StubAIProvider()

if (providerType === 'openai' && openaiApiKey) {
  activeProviderInstance = buildProductionProxy(
    new OpenAIProvider(openaiApiKey),
    'openai',
    process.env.OPENAI_FAST_MODEL || 'gpt-5-mini',
  )
  activeProviderLabel = 'openai'
  console.log('AI Growth Engine: Active Provider resolved to [OpenAI] (no stub fallback — errors propagate)')
} else if (providerType === 'gemini' && geminiApiKey) {
  activeProviderInstance = buildProductionProxy(
    new GeminiProvider(geminiApiKey),
    'gemini',
    process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  )
  activeProviderLabel = 'gemini'
  console.log('AI Growth Engine: Active Provider resolved to [Gemini] (no stub fallback — errors propagate)')
} else if (providerType === 'groq' && groqApiKey) {
  activeProviderInstance = buildProductionProxy(
    new GroqProvider(groqApiKey),
    'groq',
    process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
  )
  activeProviderLabel = 'groq'
  console.log('AI Growth Engine: Active Provider resolved to [Groq] (no stub fallback — errors propagate)')
} else {
  activeProviderInstance = stubProvider
  activeProviderLabel = 'stub'
  console.log(`AI Growth Engine: Active Provider resolved to [Stub/Mock] (AI_PROVIDER=${providerType || 'unset'})`)
}

export const aiProvider = activeProviderInstance

export function getAIProvider() {
  return activeProviderInstance
}

export function getActiveProviderName() {
  return activeProviderLabel
}
