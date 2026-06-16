/**
 * Base class/interface for Instagram Data Providers.
 * All custom providers (RapidAPI, Meta Graph API, Mock) must extend this class
 * and implement its methods.
 */
export default class InstagramProvider {
  /**
   * Fetch Instagram Profile details
   * @param {string} username 
   * @returns {Promise<object>}
   */
  async getProfile(username) {
    throw new Error('getProfile() not implemented')
  }

  /**
   * Fetch Reels for a given username
   * @param {string} username 
   * @returns {Promise<Array>}
   */
  async getReels(username) {
    throw new Error('getReels() not implemented')
  }

  /**
   * Fetch comments for a specific Reel ID
   * @param {string} reelId 
   * @returns {Promise<Array>}
   */
  async getComments(reelId) {
    throw new Error('getComments() not implemented')
  }

  /**
   * Fetch aggregated analytics metrics for a username
   * @param {string} username 
   * @returns {Promise<object>}
   */
  async getAnalytics(username) {
    throw new Error('getAnalytics() not implemented')
  }

  /**
   * Health check endpoint to verify provider availability/connection status
   * @returns {Promise<object>}
   */
  async healthCheck() {
    throw new Error('healthCheck() not implemented')
  }
}
