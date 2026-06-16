import axios from 'axios'
import { BasePublishingProvider } from './providerInterface.js'
import { decrypt } from '../../utils/encryption.js'
import twitterOAuthService from '../twitterOAuthService.js'

export class TwitterPublishingProvider extends BasePublishingProvider {
  /**
   * Publishes a post to Twitter/X. Handles threads automatically.
   */
  async publishPost(post, account) {
    console.log(`[TwitterPublishingProvider] Publishing post ${post._id} to @${account.username}`)
    
    const decryptedToken = decrypt(account.accessToken)
    if (!decryptedToken) {
      return { success: false, error: 'Failed to decrypt access token', errorType: 'auth_error' }
    }

    // Determine tweets list (single vs thread)
    let tweetsList = []
    if (post.content.thread && Array.isArray(post.content.thread) && post.content.thread.length > 0) {
      tweetsList = post.content.thread.filter(t => t.trim().length > 0)
    } else {
      const text = post.content.fullText || `${post.content.hook || ''}\n\n${post.content.body || ''}\n\n${post.content.cta || ''}`.trim()
      tweetsList = [text]
    }

    // Content Validation
    if (tweetsList.length === 0 || tweetsList.every(t => t.trim().length === 0)) {
      return {
        success: false,
        error: 'Validation failed: Content is empty',
        errorType: 'validation_error'
      }
    }

    for (let i = 0; i < tweetsList.length; i++) {
      if (tweetsList[i].length > 280) {
        return {
          success: false,
          error: `Validation failed: Tweet index ${i} exceeds 280-character limit (current: ${tweetsList[i].length} chars)`,
          errorType: 'validation_error'
        }
      }
    }

    const isLiveMode = process.env.PUBLISHING_MODE === 'live'

    // Mock Mode Bypass
    if (!isLiveMode) {
      console.log(`[TwitterPublishingProvider] MOCK MODE: Simulating tweet dispatch for testing`)
      await new Promise(r => setTimeout(r, 150))
      
      if (post.topic?.toLowerCase().includes('fail')) {
        return {
          success: false,
          error: 'Simulated API Exception: Twitter/X rate limits exceeded (code 88).',
          errorType: 'rate_limit',
          response: { error_code: 88, detail: 'Rate limit exceeded' }
        }
      }

      const mockId = `mock_twt_id_${Math.random().toString(36).substring(2, 10)}`
      return {
        success: true,
        platformPostId: mockId,
        platformResponse: { simulated: true, id: mockId, text: tweetsList[0], isThread: tweetsList.length > 1 }
      }
    }

    try {
      let parentTweetId = null
      let lastTweetId = null
      const responsePayloads = []

      for (let i = 0; i < tweetsList.length; i++) {
        const tweetText = tweetsList[i]
        const body = { text: tweetText }
        
        if (lastTweetId) {
          body.reply = { in_reply_to_tweet_id: lastTweetId }
        }

        console.log(`[TwitterPublishingProvider] Posting tweet ${i + 1}/${tweetsList.length}: "${tweetText.substring(0, 35)}..."`)
        
        const response = await axios.post('https://api.twitter.com/2/tweets', body, {
          headers: {
            'Authorization': `Bearer ${decryptedToken}`,
            'Content-Type': 'application/json'
          }
        })

        const createdId = response.data.data.id
        if (i === 0) {
          parentTweetId = createdId
        }
        lastTweetId = createdId
        responsePayloads.push(response.data)
      }

      return {
        success: true,
        platformPostId: parentTweetId, // Store parent tweet ID as primary reference
        platformResponse: {
          tweets: responsePayloads,
          isThread: tweetsList.length > 1,
          threadCount: tweetsList.length,
          publishedAt: new Date().toISOString()
        }
      }

    } catch (err) {
      console.error('[TwitterPublishingProvider] Publishing failed:', err.response?.data || err.message)
      
      // Classify error type
      let errorType = 'provider_error'
      const status = err.response?.status
      const detail = err.response?.data?.detail || ''
      
      if (status === 401 || status === 403) {
        errorType = 'auth_error'
      } else if (status === 429 || detail.toLowerCase().includes('rate limit')) {
        errorType = 'rate_limit'
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        errorType = 'network_error'
      }

      return {
        success: false,
        error: err.response?.data?.detail || err.response?.data?.title || err.message,
        errorType,
        response: err.response?.data
      }
    }
  }

  /**
   * Verifies if Twitter API access token is valid.
   */
  async validateAccount(account) {
    if (!account.accessToken) return false
    const decryptedToken = decrypt(account.accessToken)
    if (!decryptedToken) return false

    const isLiveMode = process.env.PUBLISHING_MODE === 'live'
    if (!isLiveMode) {
      return true
    }

    try {
      const response = await axios.get('https://api.twitter.com/2/users/me', {
        headers: { Authorization: `Bearer ${decryptedToken}` }
      })
      return response.status === 200
    } catch (err) {
      console.warn(`[TwitterPublishingProvider] Token validation failed for @${account.username}:`, err.message)
      return false
    }
  }

  /**
   * Refreshes Twitter credentials.
   */
  async refreshToken(account) {
    console.log(`[TwitterPublishingProvider] Refreshing token for account ${account._id}`)
    return await twitterOAuthService.refreshAccessToken(account._id)
  }

  /**
   * Deletes a published tweet.
   */
  async deletePost(providerPostId, account) {
    const decryptedToken = decrypt(account.accessToken)
    if (!decryptedToken) throw new Error('Failed to decrypt token')

    const isLiveMode = process.env.PUBLISHING_MODE === 'live'
    if (!isLiveMode || process.env.TWITTER_CLIENT_ID?.startsWith('mock_')) {
      console.log(`[TwitterPublishingProvider] MOCK MODE: Simulating tweet deletion for ${providerPostId}`)
      return true
    }

    try {
      const response = await axios.delete(`https://api.twitter.com/2/tweets/${providerPostId}`, {
        headers: { Authorization: `Bearer ${decryptedToken}` }
      })
      return response.data?.data?.deleted === true
    } catch (err) {
      console.error(`[TwitterPublishingProvider] Failed to delete tweet ${providerPostId}:`, err.response?.data || err.message)
      return false
    }
  }

  /**
   * Retrieves provider health metrics for this integration.
   */
  async providerHealth(account) {
    try {
      const isValid = await this.validateAccount(account)
      return {
        status: isValid ? 'healthy' : 'unhealthy',
        details: {
          username: account.username,
          scopes: account.scopes,
          connectionStatus: account.connectionStatus,
          lastTokenRefreshAt: account.lastTokenRefreshAt
        }
      }
    } catch (err) {
      return {
        status: 'unhealthy',
        error: err.message
      }
    }
  }
}
