import axios from 'axios'
import InstagramProvider from './instagramProvider.js'
import InstagramReel from '../../models/InstagramReel.js'

// ────────────────────────────────────────────────────────────────────────
// ApifyProvider — Instagram data via Apify's `apify~instagram-scraper` actor.
//
// One actor handles all four content types via the `resultsType` parameter:
//   - "details"  → profile metadata
//   - "reels"    → reel feed (Video posts)
//   - "posts"    → mixed feed (Image/Sidecar/Video)
//   - "comments" → comments for a specific post/reel URL
//
// Input format (verified against live actor runs 2026-07-17):
//   {
//     directUrls: ['https://www.instagram.com/<user>/'],
//     resultsType: 'details' | 'reels' | 'posts' | 'comments',
//     resultsLimit: N
//   }
//
// Auth: Bearer token in Authorization header.
// Endpoint: POST /v2/acts/apify~instagram-scraper/run-sync-get-dataset-items
// Pricing: $0.0023 per result on the FREE plan ($5/mo credit ≈ 2,170 results).
// ────────────────────────────────────────────────────────────────────────

const ACTOR_ID = 'apify~instagram-scraper'
const APIFY_BASE = 'https://api.apify.com/v2'

// Tunables — kept conservative to stay inside the FREE plan per sync.
// Override via env if a workspace needs more.
const PROFILE_RESULTS_LIMIT = 1
const REELS_RESULTS_LIMIT = parseInt(process.env.APIFY_REELS_LIMIT || '50', 10)
const COMMENTS_RESULTS_LIMIT = process.env.APIFY_COMMENTS_LIMIT === '0' || process.env.APIFY_COMMENTS_LIMIT === 'all'
  ? undefined
  : parseInt(process.env.APIFY_COMMENTS_LIMIT || '1000', 10)

// Apify sync endpoint takes a `timeout` (seconds) for how long to wait
// before returning a 202 if the run is still going. We set it high enough
// that most runs complete in a single request.
const RUN_SYNC_TIMEOUT_SECS = 240

// HTTP timeout for our axios call — must exceed RUN_SYNC_TIMEOUT_SECS.
const HTTP_TIMEOUT_MS = 280_000

/**
 * ApifyProvider — single-actor Instagram provider.
 *
 * Reel IDs are stored as the Apify `shortCode` (e.g. "DaU63nnAkoo"). This
 * makes the comment-fetch path trivial: the route passes the stored
 * shortCode back to getComments(), which rebuilds the public post URL.
 */
export default class ApifyProvider extends InstagramProvider {
  constructor() {
    super()
    this.token = process.env.APIFY_TOKEN
  }

  _isConfigured() {
    return !!this.token
  }

  _headers() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    }
  }

  _wrapError(err, op) {
    const status = err.response?.status
    const body = err.response?.data
    let detail = err.message
    if (status === 401) detail = 'Apify unauthorized (401 — check APIFY_TOKEN)'
    else if (status === 403) detail = `Apify forbidden (403 — ${body?.error?.message || 'token may be invalid or out of credit'})`
    else if (status === 429) detail = 'Apify rate limit (429)'
    else if (status === 402) detail = `Apify payment required (402 — ${body?.error?.message || 'out of monthly credit'})`
    const wrapped = new Error(`ApifyProvider.${op} failed: ${detail}`)
    wrapped.status = status
    wrapped.upstreamBody = body
    return wrapped
  }

  /**
   * Run the actor synchronously and return its dataset items.
   * Throws a typed error if the actor itself returned `{error: ...}` rows
   * (e.g. no_items for private/deleted accounts).
   */
  async _runActor(input, op) {
    if (!this._isConfigured()) {
      throw new Error('ApifyProvider not configured: APIFY_TOKEN missing')
    }

    const url = `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?timeout=${RUN_SYNC_TIMEOUT_SECS}`
    let response
    try {
      response = await axios.post(url, input, {
        headers: this._headers(),
        timeout: HTTP_TIMEOUT_MS,
        validateStatus: () => true,
      })
    } catch (err) {
      throw this._wrapError(err, op)
    }

    if (response.status >= 400) {
      throw this._wrapError(
        { response, message: `HTTP ${response.status}` },
        op
      )
    }

    const items = Array.isArray(response.data) ? response.data : []

    // Apify signals a failed run by emitting a single row with an `error`
    // field instead of throwing an HTTP error. Surface it as a real error.
    if (items.length > 0 && items[0]?.error) {
      const e = items[0]
      const err = new Error(
        `ApifyProvider.${op}: actor returned "${e.error}"` +
        (e.errorDescription ? ` — ${e.errorDescription}` : '')
      )
      err.code = e.error === 'no_items' ? 'NO_ITEMS' : 'ACTOR_ERROR'
      err.actorError = e
      throw err
    }

    return items
  }

  // ──────────────────────────────────────────────────────────────────────
  // Field mapping helpers
  // ──────────────────────────────────────────────────────────────────────

  _num(v) {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  _date(v) {
    if (!v) return null
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
  }

  /**
   * Build the profile result the rest of the pipeline expects.
   * Field names verified against apify_final_profile.json.
   */
  _buildProfile(item, fallbackUsername) {
    return {
      username: item.username || fallbackUsername,
      fullName: item.fullName || '',
      bio: item.biography || item.bio || '',
      profilePic: item.profilePicUrlHD || item.profilePicUrl || '',
      followers: this._num(item.followersCount),
      following: this._num(item.followsCount),
      postsCount: this._num(item.postsCount),
      verified: !!item.verified,
      accountId: String(item.id || ''),
      isMock: false,
      source: 'apify',
      rawPayload: item,
    }
  }

  /**
   * Build a single reel result.
   * reelId is the shortCode so getComments() can rebuild the URL cheaply.
   * Field names verified against apify_final_reels.json.
   */
  _buildReel(item) {
    const shortCode = item.shortCode || ''
    return {
      reelId: shortCode || String(item.id || ''),
      caption: item.caption || '',
      views: this._num(item.videoPlayCount || item.videoViewCount),
      likes: this._num(item.likesCount),
      comments: this._num(item.commentsCount),
      publishDate: this._date(item.timestamp) || new Date(),
      mediaType: item.type === 'Video' ? 'Video' : (item.type || 'Video'),
      isMock: false,
      source: 'apify',
      rawPayload: item,
    }
  }

  /**
   * Build a single comment result, including its threaded replies flattened.
   * Field names verified against apify_final_comments.json.
   *
   * Apify returns up to ~30 top-level comments per run; each may include a
   * `replies` array. We flatten both so each reply is its own row in Mongo,
   * preserving a parent reference in rawPayload.
   */
  _buildComments(item, reelShortCode) {
    const out = []
    const base = {
      text: item.text || '',
      author: item.ownerUsername || item.owner?.username || 'Anonymous',
      likes: this._num(item.likesCount),
      timestamp: this._date(item.timestamp),
      isMock: false,
      source: 'apify',
    }

    out.push({
      commentId: String(item.id),
      ...base,
      rawPayload: { ...item, parentCommentId: null, reelShortCode },
    })

    if (Array.isArray(item.replies)) {
      for (const reply of item.replies) {
        if (!reply?.id) continue
        out.push({
          commentId: String(reply.id),
          text: reply.text || '',
          author: reply.ownerUsername || reply.owner?.username || 'Anonymous',
          likes: this._num(reply.likesCount),
          timestamp: this._date(reply.timestamp),
          isMock: false,
          source: 'apify',
          rawPayload: { ...reply, parentCommentId: String(item.id), reelShortCode },
        })
      }
    }
    return out
  }

  // ──────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────

  async getProfile(username) {
    const clean = String(username || '').trim().replace(/^@/, '')
    if (!clean) throw new Error('ApifyProvider.getProfile: empty username')

    const items = await this._runActor({
      directUrls: [`https://www.instagram.com/${clean}/`],
      resultsType: 'details',
      resultsLimit: PROFILE_RESULTS_LIMIT,
    }, 'getProfile')

    if (items.length === 0) {
      throw new Error(`ApifyProvider.getProfile: no profile returned for @${clean}`)
    }
    return this._buildProfile(items[0], clean)
  }

  async getReels(username) {
    const clean = String(username || '').trim().replace(/^@/, '')
    if (!clean) throw new Error('ApifyProvider.getReels: empty username')

    const items = await this._runActor({
      directUrls: [`https://www.instagram.com/${clean}/`],
      resultsType: 'posts',
      resultsLimit: REELS_RESULTS_LIMIT,
    }, 'getReels')

    return items.map(this._buildReel.bind(this))
  }

  /**
   * Fetch comments for a reel. `reelId` is the shortCode stored on the
   * InstagramReel document (e.g. "DaU63nnAkoo"). We rebuild the post URL
   * from it and run the actor with resultsType=comments.
   *
   * If the caller passes a compound "<id>_<userId>" form (legacy), we
   * gracefully extract the shortCode if possible; otherwise we throw a
   * typed error because the comments actor only accepts post/reel URLs.
   */
  async getComments(reelId) {
    if (!reelId) throw new Error('ApifyProvider.getComments: empty reelId')

    let shortCode = String(reelId)
    // Strip legacy compound form: "<mediaId>_<userId>" → not a shortCode.
    // The actor can't resolve these; the caller should pass the shortCode.
    if (shortCode.includes('_')) {
      const reelDoc = await InstagramReel.findOne({ reelId }).lean().catch(() => null)
      const resolvedCode = reelDoc?.rawPayload?.media?.code || reelDoc?.rawPayload?.code
      if (resolvedCode) {
        shortCode = resolvedCode
      } else {
        const err = new Error(
          `ApifyProvider.getComments: received compound mediaId "${shortCode}" with no shortCode in DB rawPayload.`
        )
        err.code = 'LEGACY_REEL_ID'
        throw err
      }
    }

    const input = {
      directUrls: [`https://www.instagram.com/p/${shortCode}/`],
      resultsType: 'comments',
    }
    if (COMMENTS_RESULTS_LIMIT) {
      input.resultsLimit = COMMENTS_RESULTS_LIMIT
    }

    const items = await this._runActor(input, 'getComments')

    const out = []
    for (const item of items) {
      if (!item?.id) continue
      out.push(...this._buildComments(item, shortCode))
    }
    return out
  }

  supportsComments() {
    return true
  }

  /**
   * Aggregated analytics — derived from profile + reels.
   * Mirrors the shape the previous provider returned so the snapshot
   * schema and the frontend don't need changes.
   */
  _buildAnalyticsResult(profile, reels) {
    let totalLikes = 0
    let totalComments = 0
    let totalViews = 0
    reels.forEach(r => {
      totalLikes += r.likes || 0
      totalComments += r.comments || 0
      totalViews += r.views || 0
    })

    const count = reels.length || 1
    const followers = profile.followers || 1

    return {
      username: profile.username,
      followers: profile.followers,
      following: profile.following,
      postsCount: profile.postsCount,
      averageLikes: Math.round(totalLikes / count),
      averageComments: Math.round(totalComments / count),
      averageViews: Math.round(totalViews / count),
      engagementRate: parseFloat((((totalLikes + totalComments) / count) / followers * 100).toFixed(2)),
      snapshotDate: new Date(),
      isMock: false,
      source: 'apify',
      rawPayload: {
        totalReelsCounted: reels.length,
        actorId: ACTOR_ID,
      },
    }
  }

  async getAnalytics(username) {
    const profile = await this.getProfile(username)
    const reels = await this.getReels(username)
    return this._buildAnalyticsResult(profile, reels)
  }

  async healthCheck() {
    if (!this._isConfigured()) {
      return {
        status: 'unconfigured',
        provider: 'apify',
        message: 'No APIFY_TOKEN set.',
      }
    }
    try {
      // Use the official Instagram account — always exists, low data cost.
      await this._runActor({
        directUrls: ['https://www.instagram.com/instagram/'],
        resultsType: 'details',
        resultsLimit: 1,
      }, 'healthCheck')
      return { status: 'healthy', provider: 'apify' }
    } catch (err) {
      return {
        status: 'degraded',
        provider: 'apify',
        error: err.message,
        statusCode: err.status,
        code: err.code,
      }
    }
  }
}
