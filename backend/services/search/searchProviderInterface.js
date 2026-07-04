// Search Provider Interface — contract every search backend must implement.
// The Research Engine is the only consumer; controllers and UI never touch
// this directly. Adding a new provider means: implement this interface,
// register it in services/search/index.js, set one env var.

export class SearchProviderInterface {
  // Single-query web search.
  // Returns an array of {url, title, snippet, publishedDate}.
  // Empty array = no results found (or stub mode).
  async searchWeb(_query, _opts = {}) {
    throw new Error('SearchProviderInterface.searchWeb not implemented')
  }

  // Batch variant for fan-out across many claims.
  // Returns a Map<query, results[]>. Default impl loops searchWeb — concrete
  // providers can override with a real bulk endpoint if available.
  async batchSearch(queries, opts = {}) {
    const out = new Map()
    for (const q of queries) {
      out.set(q, await this.searchWeb(q, opts))
    }
    return out
  }

  async healthCheck() {
    return { provider: this.label, configured: !!this.grounded }
  }

  get label() {
    return 'interface'
  }

  // True if this provider actually queries the live web. False for stubs.
  get grounded() {
    return false
  }
}
