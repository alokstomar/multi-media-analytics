import MockProvider from './mockProvider.js'
import RapidApiProvider from './rapidApiProvider.js'
import MetaProvider from './metaProvider.js'

let activeInstance = null

export const providerFactory = {
  /**
   * Get the active Instagram provider instance based on environment configuration
   * @returns {import('./instagramProvider.js').default}
   */
  getProvider() {
    if (activeInstance) return activeInstance

    const providerType = (process.env.INSTAGRAM_PROVIDER || 'mock').toLowerCase()

    switch (providerType) {
      case 'rapidapi':
        activeInstance = new RapidApiProvider()
        break
      case 'meta':
        activeInstance = new MetaProvider()
        break
      case 'mock':
      default:
        activeInstance = new MockProvider()
        break
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
    return (process.env.INSTAGRAM_PROVIDER || 'mock').toLowerCase()
  }
}
