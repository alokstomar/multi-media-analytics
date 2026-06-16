/**
 * Base interface representing a Publishing Provider.
 * All social media platform publishers must implement these methods.
 */
export class BasePublishingProvider {
  /**
   * Publishes a post to the platform.
   * @param {Object} post - The Post Mongoose document or object
   * @param {Object} account - The decrypted social account details
   * @returns {Promise<Object>} { success: true, platformPostId, platformResponse } or { success: false, error }
   */
  async publishPost(post, account) {
    throw new Error('publishPost not implemented')
  }

  /**
   * Validates if the credentials for the account are currently active and usable.
   * @param {Object} account - The decrypted social account details
   * @returns {Promise<boolean>}
   */
  async validateAccount(account) {
    throw new Error('validateAccount not implemented')
  }

  /**
   * Refreshes the OAuth credentials for the account.
   * @param {Object} account - The account document to refresh
   * @returns {Promise<Object>} The updated account document
   */
  async refreshToken(account) {
    throw new Error('refreshToken not implemented')
  }

  /**
   * Deletes a published post from the platform (future-ready).
   * @param {string} providerPostId - The platform's native post ID
   * @param {Object} account - The decrypted social account details
   * @returns {Promise<boolean>}
   */
  async deletePost(providerPostId, account) {
    throw new Error('deletePost not implemented')
  }

  /**
   * Retrieves the health and API access status of the provider.
   * @param {Object} account - The decrypted account document
   * @returns {Promise<Object>}
   */
  async providerHealth(account) {
    throw new Error('providerHealth not implemented')
  }
}

