// Search provider factory — mirrors services/ai/index.js. Resolution order
// (first configured wins):
//   1. SEARCH_PROVIDER=tavily + TAVILY_API_KEY  → TavilySearchProvider (grounded)
//   2. SEARCH_PROVIDER=bing + AZURE_BING_SEARCH_KEY → BingProvider (future)
//   3. default → StubSearchProvider (non-grounded)
//
// To add a real provider later: implement the interface in
// `<name>SearchProvider.js`, add an `else if` branch below, and document the
// env vars. Controllers, models, UI, prompts, AI methods, and the research
// engine itself DO NOT CHANGE.

import { StubSearchProvider } from './stubSearchProvider.js'

const providerType = process.env.SEARCH_PROVIDER || 'stub'
const tavilyApiKey = process.env.TAVILY_API_KEY
const azureBingKey = process.env.AZURE_BING_SEARCH_KEY

let activeProviderInstance
let activeProviderLabel = 'stub'

if (providerType === 'tavily' && tavilyApiKey) {
  const { TavilySearchProvider } = await import('./tavilySearchProvider.js')
  activeProviderInstance = new TavilySearchProvider(tavilyApiKey)
  activeProviderLabel = 'tavily'
} else if (providerType === 'tavily' && !tavilyApiKey) {
  console.warn('[Search] SEARCH_PROVIDER=tavily but TAVILY_API_KEY is missing — falling back to stub.')
  activeProviderInstance = new StubSearchProvider()
  activeProviderLabel = 'stub'
} else if (providerType === 'bing' && azureBingKey) {
  // Future: import { BingSearchProvider } from './bingSearchProvider.js'
  console.warn('[Search] SEARCH_PROVIDER=bing is not implemented yet — falling back to stub. Implement backend/services/search/bingSearchProvider.js to enable.')
  activeProviderInstance = new StubSearchProvider()
  activeProviderLabel = 'stub'
} else {
  activeProviderInstance = new StubSearchProvider()
  activeProviderLabel = 'stub'
}

const grounded = activeProviderInstance.grounded
console.log(
  `[Search] Active provider: ${activeProviderLabel} `
  + `(${grounded ? 'grounded' : 'non-grounded'})`,
)

export function getSearchProvider() {
  return activeProviderInstance
}

export function getSearchProviderLabel() {
  return activeProviderLabel
}

export function isSearchGrounded() {
  return grounded
}
