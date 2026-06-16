import axios from 'axios'
import { BasePublishingProvider } from './providerInterface.js'
import { decrypt } from '../../utils/encryption.js'
import instagramOAuthService from '../instagramOAuthService.js'

export class InstagramPublishingProvider extends BasePublishingProvider {
  /**
   * Validates Instagram post media before submission or execution.
   */
  validateMedia(media, contentType) {
    const validTypes = ['image', 'carousel', 'reel']
    if (!contentType || !validTypes.includes(contentType.toLowerCase())) {
      const err = new Error(`Validation failed: Invalid contentType. Supported: ${validTypes.join(', ')}`)
      err.errorType = 'validation_error'
      throw err
    }

    if (!media) {
      const err = new Error('Validation failed: Media attachments are required for Instagram posts')
      err.errorType = 'validation_error'
      throw err
    }

    // Resolve media list
    let urls = []
    if (typeof media === 'string') {
      urls = [media]
    } else if (Array.isArray(media)) {
      urls = media
    } else if (media.urls && Array.isArray(media.urls)) {
      urls = media.urls
    } else if (media.url) {
      urls = [media.url]
    }

    // Clean up empty strings
    urls = urls.filter(u => typeof u === 'string' && u.trim().length > 0)

    if (urls.length === 0) {
      const err = new Error('Validation failed: At least one media URL is required')
      err.errorType = 'validation_error'
      throw err
    }

    const type = contentType.toLowerCase()
    if (type === 'image' && urls.length < 1) {
      const err = new Error('Validation failed: Image post requires at least 1 image URL')
      err.errorType = 'validation_error'
      throw err
    }

    if (type === 'carousel' && urls.length < 2) {
      const err = new Error('Validation failed: Carousel post requires at least 2 media URLs')
      err.errorType = 'validation_error'
      throw err
    }

    if (type === 'reel' && urls.length < 1) {
      const err = new Error('Validation failed: Reel requires at least 1 video URL')
      err.errorType = 'validation_error'
      throw err
    }

    return urls
  }

  /**
   * Publishes a post to Instagram. Supports Single Image, Carousel, and Reels.
   */
  async publishPost(post, account) {
    console.log(`[InstagramPublishingProvider] Publishing post ${post._id} to Instagram account: ${account.username}`)

    const decryptedToken = decrypt(account.accessToken)
    if (!decryptedToken) {
      return { success: false, error: 'Failed to decrypt access token', errorType: 'auth_error' }
    }

    const caption = post.content?.fullText || `${post.content?.hook || ''}\n\n${post.content?.body || ''}\n\n${post.content?.cta || ''}`.trim()
    
    // Resolve content type: default to 'image', can be overridden in post.content.contentType or post.type
    let contentType = post.content?.contentType || post.type || 'image'
    // Map post type enums to instagram content types
    if (contentType === 'reel-caption' || contentType === 'story-content') {
      contentType = 'reel'
    } else if (contentType === 'carousel-caption') {
      contentType = 'carousel'
    } else if (contentType === 'post' || contentType === 'discussion') {
      contentType = 'image'
    }

    // Resolve media attachment
    const rawMedia = post.content?.mediaUrls || post.content?.media || post.media || []
    
    let mediaUrls = []
    try {
      mediaUrls = this.validateMedia(rawMedia, contentType)
    } catch (valErr) {
      return {
        success: false,
        error: valErr.message,
        errorType: valErr.errorType || 'validation_error'
      }
    }

    const isLiveMode = process.env.PUBLISHING_MODE === 'live'
    const isMock = !isLiveMode || process.env.INSTAGRAM_CLIENT_ID?.startsWith('mock_')

    // Mock Mode Bypass
    if (isMock) {
      console.log(`[InstagramPublishingProvider] MOCK MODE: Simulating Instagram dispatch for testing`)
      await new Promise(r => setTimeout(r, 150))

      if (post.topic?.toLowerCase().includes('fail')) {
        return {
          success: false,
          error: 'Simulated API Exception: Meta Graph API rate limit weight exceeded (code 4).',
          errorType: 'rate_limit',
          response: { error_code: 4, detail: 'Rate limit exceeded' }
        }
      }

      const mockId = `mock_ig_media_${Math.random().toString(36).substring(2, 10)}`
      return {
        success: true,
        platformPostId: mockId,
        platformResponse: {
          simulated: true,
          instagramPostId: mockId,
          contentType,
          mediaUrls,
          caption
        }
      }
    }

    const instagramUserId = account.instagramUserId

    try {
      let creationId = null
      const type = contentType.toLowerCase()

      if (type === 'image') {
        // 1. Create Media Container for Single Image
        const containerRes = await axios.post(`https://graph.facebook.com/v19.0/${instagramUserId}/media`, {
          image_url: mediaUrls[0],
          caption,
          access_token: decryptedToken
        })
        creationId = containerRes.data.id
      } else if (type === 'reel') {
        // 1. Create Media Container for Video / Reel
        const containerRes = await axios.post(`https://graph.facebook.com/v19.0/${instagramUserId}/media`, {
          media_type: 'REELS',
          video_url: mediaUrls[0],
          caption,
          access_token: decryptedToken
        })
        creationId = containerRes.data.id
      } else if (type === 'carousel') {
        // 1. Create individual item containers
        const itemIds = []
        for (const url of mediaUrls) {
          const isVideo = url.toLowerCase().endsWith('.mp4') || url.toLowerCase().includes('.mov')
          const itemRes = await axios.post(`https://graph.facebook.com/v19.0/${instagramUserId}/media`, {
            [isVideo ? 'video_url' : 'image_url']: url,
            is_carousel_item: true,
            access_token: decryptedToken
          })
          itemIds.push(itemRes.data.id)
        }

        // 2. Create Carousel Container linking items
        const containerRes = await axios.post(`https://graph.facebook.com/v19.0/${instagramUserId}/media`, {
          media_type: 'CAROUSEL',
          children: itemIds,
          caption,
          access_token: decryptedToken
        })
        creationId = containerRes.data.id
      }

      if (!creationId) {
        throw new Error('Failed to retrieve Media creation_id container from Meta servers')
      }

      // 3. Publish Media Container
      const publishRes = await axios.post(`https://graph.facebook.com/v19.0/${instagramUserId}/media_publish`, {
        creation_id: creationId,
        access_token: decryptedToken
      })

      const instagramPostId = publishRes.data.id

      return {
        success: true,
        platformPostId: instagramPostId,
        platformResponse: {
          instagramPostId,
          publishedAt: new Date().toISOString(),
          contentType,
          mediaUrls,
          containerId: creationId,
          metaResponse: publishRes.data
        }
      }

    } catch (err) {
      console.error('[InstagramPublishingProvider] Meta Graph API Publishing failed:', err.response?.data || err.message)
      
      let errorType = 'provider_error'
      const status = err.response?.status
      const metaError = err.response?.data?.error || {}
      const code = metaError.code
      const msg = metaError.message || err.message

      if (status === 401 || status === 403 || code === 190 || code === 102) {
        errorType = 'auth_error'
      } else if (status === 429 || code === 4 || code === 17) {
        errorType = 'rate_limit'
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        errorType = 'network_error'
      }

      return {
        success: false,
        error: msg,
        errorType,
        response: err.response?.data
      }
    }
  }

  /**
   * Checks if Instagram credentials are active.
   */
  async validateAccount(account) {
    if (!account.accessToken) return false
    const decryptedToken = decrypt(account.accessToken)
    if (!decryptedToken) return false

    const isLiveMode = process.env.PUBLISHING_MODE === 'live'
    if (!isLiveMode || process.env.INSTAGRAM_CLIENT_ID?.startsWith('mock_')) {
      return true
    }

    try {
      const response = await axios.get(`https://graph.facebook.com/v19.0/${account.instagramUserId}`, {
        params: { fields: 'id', access_token: decryptedToken }
      })
      return response.status === 200
    } catch (err) {
      console.warn(`[InstagramPublishingProvider] Token validation failed for ${account.username}:`, err.message)
      return false
    }
  }

  /**
   * Refreshes Instagram credentials.
   */
  async refreshToken(account) {
    console.log(`[InstagramPublishingProvider] Refreshing token for account ${account._id}`)
    return await instagramOAuthService.refreshAccessToken(account._id)
  }

  /**
   * Deletes a published media item (future-ready).
   */
  async deletePost(providerPostId, account) {
    const decryptedToken = decrypt(account.accessToken)
    if (!decryptedToken) throw new Error('Failed to decrypt token')

    const isLiveMode = process.env.PUBLISHING_MODE === 'live'
    if (!isLiveMode || process.env.INSTAGRAM_CLIENT_ID?.startsWith('mock_')) {
      console.log(`[InstagramPublishingProvider] MOCK MODE: Simulating Instagram media deletion for ${providerPostId}`)
      return true
    }

    try {
      const response = await axios.delete(`https://graph.facebook.com/v19.0/${providerPostId}`, {
        params: { access_token: decryptedToken }
      })
      return response.data?.success === true
    } catch (err) {
      console.error(`[InstagramPublishingProvider] Failed to delete media ${providerPostId}:`, err.response?.data || err.message)
      return false
    }
  }

  /**
   * Retrieves provider health metrics.
   */
  async providerHealth(account) {
    try {
      const isValid = await this.validateAccount(account)
      return {
        status: isValid ? 'healthy' : 'unhealthy',
        details: {
          username: account.username,
          displayName: account.displayName,
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
