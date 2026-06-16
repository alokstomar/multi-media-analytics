import axios from 'axios'
import InstagramProvider from './instagramProvider.js'

/**
 * RapidApiProvider — third-party Instagram scraper.
 *
 * Errors are surfaced, not silently swallowed. Returning mock data on a real
 * API failure hid credential/subscription problems and produced dashboards that
 * looked like they were working but weren't. Failures now propagate so the
 * frontend can show the real cause.
 */
export default class RapidApiProvider extends InstagramProvider {
  constructor() {
    super()
    this.apiKey = process.env.RAPIDAPI_KEY
    this.host = process.env.RAPIDAPI_HOST
  }

  _isConfigured() {
    return !!(this.apiKey && this.host)
  }

  _getHeaders() {
    return {
      'x-rapidapi-key': this.apiKey,
      'x-rapidapi-host': this.host,
    }
  }

  _wrapError(err, op) {
    const status = err.response?.status
    const body = err.response?.data
    let detail = err.message
    if (status === 403 && body?.message) detail = `${body.message} (status 403 — check RapidAPI subscription)`
    else if (status === 429) detail = `RapidAPI rate limit exceeded (429)`
    else if (status === 401) detail = `RapidAPI unauthorized (401 — check RAPIDAPI_KEY)`
    const wrapped = new Error(`RapidApiProvider.${op} failed: ${detail}`)
    wrapped.status = status
    wrapped.upstreamBody = body
    return wrapped
  }

  async getProfile(username) {
    if (!this._isConfigured()) {
      throw new Error('RapidApiProvider not configured: RAPIDAPI_KEY or RAPIDAPI_HOST missing')
    }

    const url = `https://${this.host}/getUserInfoByUsername?username=${username}`
    let response
    try {
      response = await axios.get(url, { headers: this._getHeaders(), timeout: 15000 })
    } catch (err) {
      throw this._wrapError(err, 'getProfile')
    }

    const data = response.data?.data || response.data?.user || response.data || {}
    const accountId = data.id || data.pk || data.pk_id || data.instagramUserId || ''

    return {
      username: data.username || username,
      fullName: data.full_name || data.fullName || '',
      bio: data.biography || data.bio || '',
      profilePic: data.profile_pic_url || data.profilePic || '',
      followers: data.follower_count || data.followers || 0,
      following: data.following_count || data.following || 0,
      postsCount: data.media_count || data.postsCount || 0,
      verified: !!(data.is_verified || data.verified),
      accountId: String(accountId),
      isMock: false,
      source: 'rapidapi',
      rawPayload: response.data
    }
  }

  async getReels(username) {
    if (!this._isConfigured()) {
      throw new Error('RapidApiProvider not configured: RAPIDAPI_KEY or RAPIDAPI_HOST missing')
    }

    let profile
    try {
      profile = await this.getProfile(username)
    } catch (err) {
      throw err
    }
    const userId = profile.accountId || ''

    const url = `https://${this.host}/getUserFeedById?id=${userId}`
    let response
    try {
      response = await axios.get(url, { headers: this._getHeaders(), timeout: 15000 })
    } catch (err) {
      throw this._wrapError(err, 'getReels')
    }

    const items = response.data?.items || response.data?.data || response.data?.reels || []

    const reels = items.map(item => {
      let mediaType = 'Video'
      if (item.media_type === 1) mediaType = 'Image'
      else if (item.media_type === 8) mediaType = 'Carousel'

      return {
        reelId: item.id || item.pk || `reel_${Math.random().toString(36).substr(2, 9)}`,
        caption: item.caption?.text || item.caption || '',
        views: item.play_count || item.view_count || item.views || 0,
        likes: item.like_count || item.likes || 0,
        comments: item.comment_count || item.comments || 0,
        publishDate: item.taken_at ? new Date(item.taken_at * 1000) : new Date(),
        mediaType,
        isMock: false,
        source: 'rapidapi',
        rawPayload: item
      }
    })
    return reels
  }

  async getComments(reelId) {
    if (!this._isConfigured()) {
      throw new Error('RapidApiProvider not configured: RAPIDAPI_KEY or RAPIDAPI_HOST missing')
    }

    const url = `https://${this.host}/getMediaCommentsById?id=${reelId}`
    let response
    try {
      response = await axios.get(url, { headers: this._getHeaders(), timeout: 15000 })
    } catch (err) {
      throw this._wrapError(err, 'getComments')
    }

    const items = response.data?.comments || response.data?.data || []

    return items.map(item => ({
      commentId: item.id || item.pk || `comment_${Math.random().toString(36).substr(2, 9)}`,
      text: item.text || '',
      author: item.user?.username || item.username || 'Anonymous',
      sentiment: 'neutral',
      isMock: false,
      source: 'rapidapi',
      rawPayload: item
    }))
  }

  async getAnalytics(username) {
    const profile = await this.getProfile(username)
    const reels = await this.getReels(username)

    let totalLikes = 0
    let totalComments = 0
    let totalViews = 0

    reels.forEach(r => {
      totalLikes += r.likes || 0
      totalComments += r.comments || 0
      totalViews += r.views || 0
    })

    const count = reels.length || 1
    const avgLikes = Math.round(totalLikes / count)
    const avgComments = Math.round(totalComments / count)
    const avgViews = Math.round(totalViews / count)

    const followers = profile.followers || 1
    const engagementRate = parseFloat((((avgLikes + avgComments) / followers) * 100).toFixed(2))

    return {
      username: profile.username,
      followers: profile.followers,
      following: profile.following,
      postsCount: profile.postsCount,
      averageLikes: avgLikes,
      averageComments: avgComments,
      averageViews: avgViews,
      engagementRate,
      snapshotDate: new Date(),
      isMock: false,
      source: 'rapidapi',
      rawPayload: { totalReelsCounted: reels.length }
    }
  }

  async healthCheck() {
    if (!this._isConfigured()) {
      return { status: 'unconfigured', provider: 'rapidapi', message: 'No API keys provided.' }
    }

    try {
      const url = `https://${this.host}/`
      const response = await axios.get(url, { headers: this._getHeaders(), timeout: 3000 })
      return { status: 'healthy', provider: 'rapidapi', statusCode: response.status }
    } catch (err) {
      return { status: 'degraded', provider: 'rapidapi', error: err.message, statusCode: err.response?.status }
    }
  }
}
