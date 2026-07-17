import MockProvider from './mockProvider.js'
import MetaProvider from './metaProvider.js'
import ApifyProvider from './apifyProvider.js'

const VALID_PROVIDERS = ['apify', 'meta', 'mock']

let activeInstance = null

/**
 * Read and validate INSTAGRAM_PROVIDER. The value MUST be set explicitly —
 * there is no silent default. A missing or unrecognized value throws at first
 * access so the misconfiguration is impossible to miss.
 *
 * Why: earlier versions defaulted to 'mock' on any unrecognized value, which
 * silently produced "Samay Raina (Mock)" accounts in production whenever the
 * env var was missing or typo'd. MockProvider must be an explicit opt-in for
 * development, never a fallback.
 */
function resolveProviderType() {
  const raw = (process.env.INSTAGRAM_PROVIDER || '').trim().toLowerCase()
  if (!raw) {
    const err = new Error(
      'INSTAGRAM_PROVIDER is not configured. Set it to one of: ' +
      VALID_PROVIDERS.join(', ') + '.'
    )
    err.status = 500
    err.name = 'ProviderConfigError'
    throw err
  }
  if (!VALID_PROVIDERS.includes(raw)) {
    const err = new Error(
      `INSTAGRAM_PROVIDER="${raw}" is not supported. Valid values: ` +
      VALID_PROVIDERS.join(', ') + '.'
    )
    err.status = 500
    err.name = 'ProviderConfigError'
    throw err
  }
  return raw
}

export const providerFactory = {
  /**
   * Get the active Instagram provider instance based on environment configuration.
   * @returns {import('./instagramProvider.js').default}
   */
  getProvider() {
    if (activeInstance) return activeInstance

    const providerType = resolveProviderType()

    switch (providerType) {
      case 'apify':
        activeInstance = new ApifyProvider()
        break
      case 'meta':
        activeInstance = new MetaProvider()
        break
      case 'mock':
        activeInstance = new MockProvider()
        break
      // resolveProviderType() rejects anything else before we get here.
    }

    return activeInstance
  },

  /**
   * Reset active provider cache (useful for dynamic switching or tests)
   */
  resetProvider() {
    activeInstance = null
  },

  /**
   * Get the active provider label
   * @returns {string}
   */
  getProviderLabel() {
    return resolveProviderType()
  }
}
