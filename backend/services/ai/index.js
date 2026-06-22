import { StubAIProvider } from './stubProvider.js'
import { OpenAIProvider } from './openaiProvider.js'
import { GeminiProvider } from './geminiProvider.js'
import { GroqProvider } from './groqProvider.js'

const providerType = process.env.AI_PROVIDER || 'stub'
const openaiApiKey = process.env.OPENAI_API_KEY
const geminiApiKey = process.env.GEMINI_API_KEY
const groqApiKey = process.env.GROQ_API_KEY

// Shared method list — kept identical across providers so the proxy/fallback
// behavior is uniform regardless of which AI_PROVIDER is active.
const PROVIDER_METHOD_NAMES = [
  'healthCheck',
  'generateTweet', 'generateThread', 'analyzeTweet',
  'generateContentIdeas', 'findTrendingTopics',
  'generateLinkedInPost', 'generateThoughtLeadership',
  'analyzeLinkedInPost', 'discoverIndustryTrends', 'repurposeContent',
  // Priority 1 — YouTube Content Intelligence
  'analyzeTitle', 'analyzeThumbnail',
  'generateVideoIdeas', 'generateShortsIdeas',
  'getStrategistTips',
  // Portfolio Intelligence
  'getPortfolioSummary', 'getAudienceOverlap', 'getCrossPromotion',
  'getPortfolioContentGaps', 'getCannibalization', 'getPortfolioStrategist'
]

// Build a fallback proxy around a primary provider so any thrown error
// transparently degrades to the deterministic stub. Provider name is used
// only for log prefixing so operators can see which upstream failed.
function buildProxyWithStubFallback(primaryProvider, providerLabel) {
  const proxy = {}
  for (const name of PROVIDER_METHOD_NAMES) {
    proxy[name] = async function (...args) {
      try {
        if (typeof primaryProvider[name] !== 'function') {
          return stubFallback[name](...args)
        }
        return await primaryProvider[name](...args)
      } catch (err) {
        console.warn(`[AI Fallback] ${name} ${providerLabel} failed: ${err.message} — falling back to stub provider`)
        return stubFallback[name](...args)
      }
    }
  }
  return proxy
}

let activeProviderInstance
const stubFallback = new StubAIProvider()

if (providerType === 'openai' && openaiApiKey) {
  activeProviderInstance = buildProxyWithStubFallback(new OpenAIProvider(openaiApiKey), 'OpenAI')
  console.log('AI Growth Engine: Active Provider resolved to [OpenAI] (with stub fallback)')
} else if (providerType === 'gemini' && geminiApiKey) {
  activeProviderInstance = buildProxyWithStubFallback(new GeminiProvider(geminiApiKey), 'Gemini')
  console.log('AI Growth Engine: Active Provider resolved to [Gemini] (with stub fallback)')
} else if (providerType === 'groq' && groqApiKey) {
  activeProviderInstance = buildProxyWithStubFallback(new GroqProvider(groqApiKey), 'Groq')
  console.log('AI Growth Engine: Active Provider resolved to [Groq] (with stub fallback)')
} else {
  activeProviderInstance = stubFallback
  console.log(`AI Growth Engine: Active Provider resolved to [Stub/Mock] (AI_PROVIDER=${providerType || 'unset'})`)
}

export const aiProvider = activeProviderInstance

export function getAIProvider() {
  return activeProviderInstance
}
