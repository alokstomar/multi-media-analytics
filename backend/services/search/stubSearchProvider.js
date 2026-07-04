import { SearchProviderInterface } from './searchProviderInterface.js'

// Stub Search Provider — non-grounded default. Returns empty arrays so the
// Research Engine still runs end-to-end: AI extracts claims, search returns
// nothing, AI marks verdicts as 'unverified' with low confidence. The UI
// surfaces the amber "Limited verification" banner so users know they'd get
// real grounding by wiring in Tavily or Bing.
//
// This is NOT a degraded production path — it's the documented default until
// a search provider is configured. The engine handles the empty results
// gracefully and the AI is instructed to mark verdicts as 'unverified'.

export class StubSearchProvider extends SearchProviderInterface {
  async searchWeb(_query, _opts = {}) {
    return []
  }

  async batchSearch(_queries, _opts = {}) {
    return new Map()
  }

  async healthCheck() {
    return { provider: 'stub', configured: true, grounded: false }
  }

  get label() {
    return 'stub'
  }

  get grounded() {
    return false
  }
}
