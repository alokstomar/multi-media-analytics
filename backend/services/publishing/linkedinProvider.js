import axios from 'axios'
import { BasePublishingProvider } from './providerInterface.js'
import { decrypt } from '../../utils/encryption.js'
import linkedinOAuthService from '../linkedinOAuthService.js'

export class LinkedInPublishingProvider extends BasePublishingProvider {
  /**
   * Publishes a post to LinkedIn. Supports personal profiles and company pages.
   */
  async publishPost(post, account) {
    console.log(`[LinkedInPublishingProvider] Publishing post ${post._id} to LinkedIn ${account.linkedinEntityType}: ${account.displayName}`)
    
    const decryptedToken = decrypt(account.accessToken)
    if (!decryptedToken) {
      return { success: false, error: 'Failed to decrypt access token', errorType: 'auth_error' }
    }

    const text = post.content.fullText || `${post.content.hook || ''}\n\n${post.content.body || ''}\n\n${post.content.cta || ''}`.trim()
    
    // Content Validation
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: 'Validation failed: Content is empty',
        errorType: 'validation_error'
      }
    }

    if (text.length > 3000) {
      return {
        success: false,
        error: `Validation failed: Post text length exceeds 3000-character limit (current: ${text.length} chars)`,
        errorType: 'validation_error'
      }
    }

    const isLiveMode = process.env.PUBLISHING_MODE === 'live'

    // Mock Mode Bypass
    if (!isLiveMode || process.env.LINKEDIN_CLIENT_ID?.startsWith('mock_')) {
      console.log(`[LinkedInPublishingProvider] MOCK MODE: Simulating LinkedIn dispatch for testing`)
      await new Promise(r => setTimeout(r, 150))

      if (post.topic?.toLowerCase().includes('fail')) {
        return {
          success: false,
          error: 'Simulated API Exception: LinkedIn token has expired or is invalid.',
          errorType: 'auth_error',
          response: { error: 'invalid_token', message: 'Token expired' }
        }
      }

      const mockId = `mock_li_id_${Math.random().toString(36).substring(2, 10)}`
      return {
        success: true,
        platformPostId: `urn:li:share:${mockId}`,
        platformResponse: { simulated: true, urn: `urn:li:share:${mockId}`, commentary: text }
      }
    }

    // Format the author URN correctly based on the connected account type
    let authorUrn = account.linkedinUserId
    if (!authorUrn.startsWith('urn:li:')) {
      authorUrn = account.linkedinEntityType === 'organization'
        ? `urn:li:organization:${account.organizationId || account.linkedinUserId}`
        : `urn:li:person:${account.linkedinUserId}`
    }

    const body = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: text
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    }

    try {
      const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', body, {
        headers: {
          'Authorization': `Bearer ${decryptedToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      })

      const platformPostId = response.data.id

      return {
        success: true,
        platformPostId, // e.g. "urn:li:share:12345"
        platformResponse: {
          ...response.data,
          publishedAt: new Date().toISOString(),
          authorUrn
        }
      }

    } catch (err) {
      console.error('[LinkedInPublishingProvider] Publishing failed:', err.response?.data || err.message)
      
      // Classify error type
      let errorType = 'provider_error'
      const status = err.response?.status
      const message = err.response?.data?.message || ''

      if (status === 401 || status === 403 || message.toLowerCase().includes('expired') || message.toLowerCase().includes('unauthorized')) {
        errorType = 'auth_error'
      } else if (status === 429) {
        errorType = 'rate_limit'
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        errorType = 'network_error'
      }

      return {
        success: false,
        error: err.response?.data?.message || err.message,
        errorType,
        response: err.response?.data
      }
    }
  }

  /**
   * Verifies if LinkedIn access token is valid.
   */
  async validateAccount(account) {
    if (!account.accessToken) return false
    const decryptedToken = decrypt(account.accessToken)
    if (!decryptedToken) return false

    const isLiveMode = process.env.PUBLISHING_MODE === 'live'
    if (!isLiveMode || process.env.LINKEDIN_CLIENT_ID?.startsWith('mock_')) {
      return true
    }

    try {
      const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${decryptedToken}` }
      })
      return response.status === 200
    } catch (err) {
      console.warn(`[LinkedInPublishingProvider] Token validation failed for ${account.displayName}:`, err.message)
      return false
    }
  }

  /**
   * Refreshes LinkedIn access token.
   */
  async refreshToken(account) {
    console.log(`[LinkedInPublishingProvider] Refreshing token for account ${account._id}`)
    return await linkedinOAuthService.refreshAccessToken(account._id)
  }

  /**
   * Deletes a published UGC post.
   */
  async deletePost(providerPostId, account) {
    const decryptedToken = decrypt(account.accessToken)
    if (!decryptedToken) throw new Error('Failed to decrypt token')

    const isLiveMode = process.env.PUBLISHING_MODE === 'live'
    if (!isLiveMode || process.env.LINKEDIN_CLIENT_ID?.startsWith('mock_')) {
      console.log(`[LinkedInPublishingProvider] MOCK MODE: Simulating LinkedIn post deletion for ${providerPostId}`)
      return true
    }

    try {
      await axios.delete(`https://api.linkedin.com/v2/ugcPosts/${providerPostId}`, {
        headers: {
          'Authorization': `Bearer ${decryptedToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        }
      })
      return true
    } catch (err) {
      console.error(`[LinkedInPublishingProvider] Failed to delete post ${providerPostId}:`, err.response?.data || err.message)
      return false
    }
  }

  /**
   * Retrieves health status for this LinkedIn connection.
   */
  async providerHealth(account) {
    try {
      const isValid = await this.validateAccount(account)
      return {
        status: isValid ? 'healthy' : 'unhealthy',
        details: {
          displayName: account.displayName,
          entityType: account.linkedinEntityType,
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
