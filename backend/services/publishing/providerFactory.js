import { TwitterPublishingProvider } from './twitterProvider.js'
import { LinkedInPublishingProvider } from './linkedinProvider.js'
import { InstagramPublishingProvider } from './instagramProvider.js'

class ProviderFactory {
  constructor() {
    this.providers = {
      twitter: new TwitterPublishingProvider(),
      linkedin: new LinkedInPublishingProvider(),
      instagram: new InstagramPublishingProvider(),
    }
  }

  /**
   * Retrieves the publishing provider for the specified platform.
   * @param {string} platform - The platform name (e.g. 'twitter', 'linkedin')
   * @returns {BasePublishingProvider} The provider instance
   */
  getProvider(platform) {
    const provider = this.providers[platform?.toLowerCase()]
    if (!provider) {
      throw new Error(`No publishing provider registered for platform: ${platform}`)
    }
    return provider
  }
}

export default new ProviderFactory()
