import axios from 'axios'
import InstagramProvider from './instagramProvider.js'
import { decrypt } from '../../utils/encryption.js'

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v19.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

/**
 * MetaProvider — real Meta Graph API implementation for Instagram Professional accounts.
 *
 * Required scopes on the stored OAuth token:
 *   instagram_basic, instagram_manage_insights, pages_show_list, business_management
 *
 * The stored InstagramAccount must have:
 *   - accessToken (AES-256-GCM encrypted at rest, decrypted here)
 *   - instagramUserId (numeric IG user id returned by Meta during OAuth)
 *
 * Username-based methods (inherited from InstagramProvider) are NOT supported by
 * Meta Graph API — they throw explicitly so callers cannot silently receive mock data.
 */
export default class MetaProvider extends InstagramProvider {
  constructor() {
    super()
  }

  /**
   * Resolve and decrypt the long-lived access token from an InstagramAccount document.
   * Throws if the account has no usable token.
   */
  _resolveToken(account) {
    if (!account) {
      throw new Error('MetaProvider requires an InstagramAccount document with an OAuth token.')
    }
    const encrypted = account.accessToken
    if (!encrypted || encrypted === 'revoked' || /^mock_access_token_/.test(encrypted) || /^mock_ig_access_token/.test(encrypted)) {
      throw new Error('Instagram account is missing a valid Meta OAuth access token. Reconnect the account via OAuth.')
    }
    if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
      throw new Error(`Instagram OAuth token expired on ${account.tokenExpiresAt.toISOString()}. Refresh or reconnect the account.`)
    }
    const token = decrypt(encrypted)
    if (!token) {
      throw new Error('Failed to decrypt Instagram access token. Verify ENCRYPTION_KEY matches the one used at connection time.')
    }
    return token
  }

  _buildUrl(path, params = {}) {
    const u = new URL(`${GRAPH_BASE}${path}`)
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue
      u.searchParams.set(k, String(v))
    }
    return u.toString()
  }

  async _get(path, params, token) {
    const url = this._buildUrl(path, { ...params, access_token: token })
    try {
      const res = await axios.get(url, { timeout: 15000 })
      return res.data
    } catch (err) {
      const body = err.response?.data
      const msg = body?.error?.message || err.message
      const code = body?.error?.code
      const subcode = body?.error?.error_subcode
      const wrapped = new Error(`Meta Graph API ${path} failed: ${msg}` + (code ? ` (code=${code}${subcode ? `, subcode=${subcode}` : ''})` : ''))
      wrapped.status = err.response?.status
      wrapped.metaError = body?.error || null
      throw wrapped
    }
  }

  /**
   * Fetch the IG user profile via /me (using the IG user id on the stored token).
   */
  async getProfileByAccount(account) {
    const token = this._resolveToken(account)
    const igUserId = account.instagramUserId
    if (!igUserId || !/^\d+$/.test(String(igUserId))) {
      throw new Error(`InstagramAccount.instagramUserId is not a numeric Meta id (got "${igUserId}"). The account was likely created via username-only path; reconnect via OAuth.`)
    }

    const fields = 'id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count'
    const data = await this._get(`/${igUserId}`, { fields }, token)

    return {
      username: data.username,
      fullName: data.name || data.username,
      bio: data.biography || '',
      profilePic: data.profile_picture_url || '',
      followers: data.followers_count || 0,
      following: data.follows_count || 0,
      postsCount: data.media_count || 0,
      verified: false, // Meta does not expose is_verified on IG node
      accountId: String(data.id),
      isMock: false,
      source: 'meta_graph_api',
      rawPayload: data,
    }
  }

  /**
   * Fetch recent media (Reels + posts) for the IG user.
   */
  async getReelsByAccount(account, limit = 25) {
    const token = this._resolveToken(account)
    const igUserId = account.instagramUserId
    if (!igUserId || !/^\d+$/.test(String(igUserId))) {
      throw new Error(`InstagramAccount.instagramUserId is not a numeric Meta id (got "${igUserId}"). Reconnect via OAuth.`)
    }

    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count'
    const data = await this._get(`/${igUserId}/media`, { fields, limit }, token)
    const items = data.data || []

    return items.map(item => {
      let mediaType = 'Video'
      if (item.media_type === 'IMAGE') mediaType = 'Image'
      else if (item.media_type === 'CAROUSEL_ALBUM') mediaType = 'Carousel'
      else if (item.media_type === 'REEL') mediaType = 'Reel'

      return {
        reelId: item.id,
        caption: item.caption || '',
        views: 0, // not available at /media level; populated via insights below if needed
        likes: item.like_count || 0,
        comments: item.comments_count || 0,
        publishDate: item.timestamp ? new Date(item.timestamp) : new Date(),
        mediaType,
        thumbnail: item.thumbnail_url || item.media_url || '',
        permalink: item.permalink || '',
        isMock: false,
        source: 'meta_graph_api',
        rawPayload: item,
      }
    })
  }

  /**
   * Fetch account-level insights for the past N days.
   * Requires instagram_manage_insights scope.
   */
  async getAccountInsights(account, days = 30) {
    const token = this._resolveToken(account)
    const igUserId = account.instagramUserId

    const since = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)
    const until = Math.floor(Date.now() / 1000)

    const params = {
      metric: 'impressions,reach,profile_views,follower_count,email_contacts,phone_call_clicks,text_message_clicks,get_directions_clicks',
      period: 'day',
      since,
      until,
    }
    const data = await this._get(`/${igUserId}/insights`, params, token)
    return { isMock: false, source: 'meta_graph_api', rawPayload: data, days }
  }

  /**
   * Fetch aggregated analytics: profile + recent media + insights.
   * Returns shape compatible with what `getAccountAnalytics` controller builds.
   */
  async getAnalyticsByAccount(account) {
    const profile = await this.getProfileByAccount(account)
    const reels = await this.getReelsByAccount(account, 25)

    let totalLikes = 0
    let totalComments = 0
    reels.forEach(r => {
      totalLikes += r.likes || 0
      totalComments += r.comments || 0
    })

    let insights = null
    try {
      insights = await this.getAccountInsights(account, 30)
    } catch (err) {
      console.warn(`[MetaProvider] Account-level insights unavailable for ${account.username}: ${err.message}`)
    }

    let reach = 0
    let impressions = 0
    let profileVisits = 0
    if (insights?.rawPayload?.data) {
      for (const m of insights.rawPayload.data) {
        const total = (m.values || []).reduce((acc, v) => acc + (v.value || 0), 0)
        if (m.name === 'reach') reach = total
        else if (m.name === 'impressions') impressions = total
        else if (m.name === 'profile_views') profileVisits = total
      }
    }

    const followers = profile.followers || 0
    const engagementRate = followers > 0
      ? parseFloat((((totalLikes + totalComments) / followers) * 100).toFixed(2))
      : 0

    return {
      profile,
      reels,
      metrics: {
        followers,
        following: profile.following,
        postsCount: profile.postsCount,
        reach,
        impressions,
        profileVisits,
        engagementRate,
        averageLikes: reels.length ? Math.round(totalLikes / reels.length) : 0,
        averageComments: reels.length ? Math.round(totalComments / reels.length) : 0,
        averageViews: 0,
      },
      insightsRaw: insights?.rawPayload || null,
      isMock: false,
      source: 'meta_graph_api',
    }
  }

  /**
   * Fetch comments for a specific IG media id.
   * Requires instagram_manage_comments or pages_read_engagement scope.
   */
  async getCommentsByAccount(account, mediaId) {
    const token = this._resolveToken(account)
    if (!mediaId) throw new Error('mediaId is required')

    try {
      const data = await this._get(`/${mediaId}/comments`, { fields: 'id,text,from,timestamp,like_count' }, token)
      const items = data.data || []
      return items.map(c => ({
        commentId: c.id,
        text: c.text || '',
        author: c.from?.username || c.from?.name || 'Anonymous',
        sentiment: 'neutral',
        isMock: false,
        source: 'meta_graph_api',
        rawPayload: c,
      }))
    } catch (err) {
      // Comments endpoint requires additional permissions; surface a clean error.
      throw new Error(`Meta comments API failed for media ${mediaId}: ${err.message}`)
    }
  }

  // ── Username-based methods (inherited) ─────────────────────────────────
  // Meta Graph API cannot resolve users by public username without an OAuth
  // token bound to that account. Refuse instead of returning mock data.
  async getProfile(username) {
    throw new Error(
      `MetaProvider.getProfile(username) is not supported — Meta Graph API requires an OAuth token. ` +
      `Use getProfileByAccount(account) instead. Username attempted: ${username}`
    )
  }

  async getReels(username) {
    throw new Error(
      `MetaProvider.getReels(username) is not supported — Meta Graph API requires an OAuth token. ` +
      `Use getReelsByAccount(account) instead. Username attempted: ${username}`
    )
  }

  async getComments(reelId) {
    throw new Error(
      `MetaProvider.getComments(reelId) is not supported — Meta Graph API requires an OAuth token. ` +
      `Use getCommentsByAccount(account, mediaId) instead. Reel attempted: ${reelId}`
    )
  }

  async getAnalytics(username) {
    throw new Error(
      `MetaProvider.getAnalytics(username) is not supported — Meta Graph API requires an OAuth token. ` +
      `Use getAnalyticsByAccount(account) instead. Username attempted: ${username}`
    )
  }

  async healthCheck() {
    return { status: 'healthy', provider: 'meta', type: 'oauth_graph_api', version: GRAPH_API_VERSION }
  }
}
