import { StubAIProvider } from './stubProvider.js'
import { OpenAIProvider } from './openaiProvider.js'

const providerType = process.env.AI_PROVIDER || 'stub'
const apiKey = process.env.OPENAI_API_KEY

let activeProviderInstance
const stubFallback = new StubAIProvider()

if (providerType === 'openai' && apiKey) {
  const openaiPrimary = new OpenAIProvider(apiKey)

  // Build a fallback proxy: every method on the provider interface
  // is wrapped so that if OpenAI throws, we silently fall back to stub
  const methodNames = [
    'generateTweet', 'generateThread', 'analyzeTweet',
    'generateContentIdeas', 'findTrendingTopics',
    'generateLinkedInPost', 'generateThoughtLeadership',
    'analyzeLinkedInPost', 'discoverIndustryTrends', 'repurposeContent'
  ]

  const proxy = {}
  for (const name of methodNames) {
    proxy[name] = async function (...args) {
      try {
        return await openaiPrimary[name](...args)
      } catch (err) {
        console.warn(`[AI Fallback] ${name} OpenAI failed: ${err.message} — falling back to stub provider`)
        return stubFallback[name](...args)
      }
    }
  }

  activeProviderInstance = proxy
  console.log('AI Growth Engine: Active Provider resolved to [OpenAI] (with stub fallback)')
} else {
  activeProviderInstance = stubFallback
  console.log('AI Growth Engine: Active Provider resolved to [Stub/Mock]')
}

export const aiProvider = activeProviderInstance

export function getAIProvider() {
  return activeProviderInstance
}
