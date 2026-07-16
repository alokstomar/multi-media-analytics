import axios from 'axios'
import InstagramProvider from './instagramProvider.js'

// ────────────────────────────────────────────────────────────────────────
// Candidate field mappings — single source of truth.
// ────────────────────────────────────────────────────────────────────────
// When the real RapidAPI response shape is verified, edit these arrays in
// one place. Every parser reads from these constants — no field names are
// hardcoded inside parser bodies. Paths are dotted strings; array indices
// use numeric segments (e.g. "edges.0.node.text").

const USER_ID_CANDIDATES = [
  // Purchased product (instagram-api-fast-reliable-data-scraper) returns
  // {UserID, UserName} from /user_id_by_username — PascalCase, top-level.
  'UserID',
  'user_id', 'id', 'pk', 'pk_id', 'instagramUserId', 'userId',
  'data.user_id', 'data.id', 'data.pk', 'data.pk_id', 'data.userId',
  'user.id', 'user.pk', 'user.user_id',
  'result.user_id', 'result.id',
]

const PROFILE_FIELD_CANDIDATES = {
  accountId: ['id', 'pk', 'pk_id', 'instagramUserId', 'userId'],
  username: ['username'],
  fullName: ['full_name', 'fullName'],
  bio: ['biography', 'bio'],
  profilePic: ['profile_pic_url', 'profilePic', 'profile_pic_url_hd'],
  followers: ['follower_count', 'followers', 'followerCount', 'edge_followed_by.count'],
  following: ['following_count', 'following', 'followingCount', 'edge_follow.count'],
  postsCount: ['media_count', 'postsCount', 'mediaCount', 'edge_owner_to_timeline_media.count'],
  verified: ['is_verified', 'verified'],
}

const REEL_ITEMS_ARRAY_CANDIDATES = [
  'items', 'data', 'reels', 'media',
  'data.items', 'data.reels', 'data.media',
  'result.items', 'result.reels', 'result.media',
  'graphql.user.edge_owner_to_timeline_media.edges',
  'result.edges', 'edges'
]

const REEL_FIELD_CANDIDATES = {
  // Purchased product wraps each item as {media: {...}} inside data.items[].
  // The _parseReelItem helper does not unwrap item.media, so media.* paths
  // must be first-class candidates.
  reelId: ['media.id', 'media.pk', 'media.media_id', 'id', 'pk', 'media_id', 'mediaId', 'reelId'],
  caption: ['media.caption.text', 'caption.text', 'caption', 'text', 'edge_media_to_caption.edges.0.node.text'],
  views: ['media.play_count', 'media.view_count', 'play_count', 'view_count', 'views', 'video_view_count', 'video_views', 'video_play_count'],
  likes: ['media.like_count', 'media.likes', 'like_count', 'likes', 'likeCount', 'edge_media_preview_like.count', 'edge_liked_by.count'],
  comments: ['media.comment_count', 'media.comments', 'comment_count', 'comments', 'commentCount', 'edge_media_to_comment.count', 'edge_media_preview_comment.count'],
  mediaType: ['media.media_type', 'media.type', 'media_type', 'type', 'mediaType'],
  timestamp: ['media.taken_at', 'media.created_at', 'taken_at', 'created_at', 'date', 'timestamp', 'taken_at_iso', 'created_at_iso'],
}

const COMMENT_ITEMS_ARRAY_CANDIDATES = [
  'comments', 'items', 'data',
  'data.comments', 'data.items',
  'result.comments', 'result.items',
  'edge_media_to_comment.edges', 'edge_media_to_parent_comment.edges',
]

const COMMENT_FIELD_CANDIDATES = {
  commentId: ['id', 'pk', 'comment_id', 'commentId'],
  text: ['text', 'content'],
  author: ['user.username', 'username', 'owner.username', 'from.username', 'commenter.username'],
}

const PAGINATION_MAX_ID_CANDIDATES = [
  'next_max_id',
  'paging.next_max_id',
  'pagination.next_max_id',
]

const PAGINATION_CURSOR_CANDIDATES = [
  'next_cursor',
  'cursor',
  'pagination.next_cursor',
  'paging.next_cursor',
]

const PAGINATION_PAGE_INFO_CANDIDATES = [
  'page_info',
  'data.page_info',
  'graphql.user.edge_owner_to_timeline_media.page_info',
]

const PAGINATION_NEXT_URL_CANDIDATES = [
  'next_url', 'next_href', 'pagination.next_url',
]

// Each entry: { flag, cursorField, type } — when body[flag] === true and
// body[cursorField] is non-empty, emit a cursor of body[cursorField].
const PAGINATION_MORE_FLAG_PAIRS = [
  { flag: 'more_available', cursorField: 'next_max_id', type: 'max_id' },
  { flag: 'has_more', cursorField: 'next_max_id', type: 'max_id' },
]

/**
 * RapidApiProvider — third-party Instagram scraper.
 *
 * Errors are surfaced, not silently swallowed. Returning mock data on a real
 * API failure hid credential/subscription problems and produced dashboards that
 * looked like they were working but weren't. Failures now propagate so the
 * frontend can show the real cause.
 *
 * Endpoint surface (documented):
 *   GET /user_id_by_username?username=X   → resolve username to user_id
 *   GET /profile?user_id=Y                 → full profile
 *   GET /reels?user_id=Y[&<pagination>]    → reels feed, paginated
 *   GET /comments?media_id=Z[&<pagination>]→ comments for one media, paginated
 *
 * Architectural separation:
 *   - Public methods (getProfile/getReels/getComments/getAnalytics) ONLY
 *     orchestrate HTTP requests and delegate to parser helpers.
 *   - Each endpoint has a dedicated parser that reads from the candidate
 *     constants above (single source of truth for field names).
 *   - Each pagination strategy has a dedicated helper. A shared coordinator
 *     tries them in priority order; both reels and comments pagination use it.
 *   - Field candidate lists are module-level constants — schema changes
 *     require edits in exactly one location per concern.
 */
export default class RapidApiProvider extends InstagramProvider {
  constructor() {
    super()
    this.apiKey = process.env.RAPIDAPI_KEY
    this.host = process.env.RAPIDAPI_HOST
    this.maxPages = parseInt(process.env.RAPIDAPI_MAX_PAGES || '50', 10)
    this.userIdCache = new Map()
  }

  _isConfigured() {
    return !!(this.apiKey && this.host)
  }

  _isInstagram120() {
    return this.host && (this.host === 'instagram120.p.rapidapi.com' || this.host.includes('instagram120'));
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

  // Permanent debug logger — default no-op. Enable with DEBUG_RAPIDAPI=true to
  // dump raw RapidAPI responses so response shapes can be verified before
  // parsers are written. Swallows all errors; debug logging must never break
  // a request.
  _logDebug(label, payload) {
    if (process.env.DEBUG_RAPIDAPI !== 'true') return
    try {
      console.log(`[RapidApiProvider:DEBUG] ${label}`)
      if (payload !== undefined) {
        console.log(JSON.stringify(payload, null, 2))
      }
    } catch {
      /* swallow */
    }
  }

  // Shared HTTP GET helper. Builds the URL with query params, applies auth
  // headers, logs request/response when DEBUG_RAPIDAPI=true, and wraps axios
  // errors via _wrapError.
  async _httpGet(path, params, op) {
    // Respect API rate limit: wait 1000ms before each HTTP request
    await new Promise(resolve => setTimeout(resolve, 1000))

    const url = new URL(`https://${this.host}${path}`)
    for (const [k, v] of Object.entries(params || {})) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, v)
      }
    }
    this._logDebug(`GET ${op} request`, { url: url.toString() })
    let response
    try {
      response = await axios.get(url.toString(), {
        headers: this._getHeaders(),
        timeout: 15000,
      })
    } catch (err) {
      this._logDebug(`GET ${op} error`, {
        status: err.response?.status,
        body: err.response?.data,
      })
      throw this._wrapError(err, op)
    }
    this._logDebug(`GET ${op} response`, response.data)
    return response.data
  }

  // Shared HTTP POST helper for endpoints requiring POST routing (e.g. instagram120.p.rapidapi.com).
  async _httpPost(path, bodyData, op) {
    // Respect API rate limit: wait 1000ms before each HTTP request
    await new Promise(resolve => setTimeout(resolve, 1000))

    const url = `https://${this.host}${path}`
    this._logDebug(`POST ${op} request`, { url, body: bodyData })
    let response
    try {
      response = await axios.post(url, bodyData, {
        headers: {
          ...this._getHeaders(),
          'Content-Type': 'application/json'
        },
        timeout: 15000,
      })
    } catch (err) {
      this._logDebug(`POST ${op} error`, {
        status: err.response?.status,
        body: err.response?.data,
      })
      throw this._wrapError(err, op)
    }
    this._logDebug(`POST ${op} response`, response.data)
    return response.data
  }

  // ──────────────────────────────────────────────────────────────────────
  // Path traversal + value helpers
  // ──────────────────────────────────────────────────────────────────────

  // Read a dotted path from a nested object. Array indices are numeric
  // segments (works because JS arrays are objects). Returns undefined if any
  // step is missing.
  _getPath(obj, dottedPath) {
    if (obj === undefined || obj === null) return undefined
    return dottedPath.split('.').reduce((acc, key) => {
      return (acc !== undefined && acc !== null) ? acc[key] : undefined
    }, obj)
  }

  _hasValue(v) {
    return v !== undefined && v !== null && v !== ''
  }

  // First non-empty value across candidate paths. Empty = undefined|null|''.
  _firstByPath(obj, candidatePaths) {
    for (const p of candidatePaths) {
      const v = this._getPath(obj, p)
      if (this._hasValue(v)) return v
    }
    return undefined
  }

  // Unwrap common nested-data envelopes. Returns the inner object when a
  // wrapper is detected; otherwise returns the body as-is.
  _unwrapDataObject(body) {
    if (!body || typeof body !== 'object') return null
    if (body.data && typeof body.data === 'object') return body.data
    if (body.user && typeof body.user === 'object') return body.user
    if (body.result && typeof body.result === 'object') return body.result
    if (body.graphql?.user && typeof body.graphql.user === 'object') return body.graphql.user
    return body
  }

  // Build a Date from the first workable timestamp candidate. Accepts
  // epoch-seconds (most common), ISO strings, or epoch-millis. Falls back to
  // current time only when no candidate is present.
  _parseTimestamp(...candidates) {
    for (const c of candidates) {
      if (!this._hasValue(c)) continue
      const n = Number(c)
      if (!Number.isNaN(n) && n > 0) {
        return new Date(n < 1e12 ? n * 1000 : n)
      }
      const d = new Date(c)
      if (!isNaN(d.getTime())) return d
    }
    return new Date()
  }

  // Map IG media_type code/value to the public mediaType contract value.
  _mapMediaType(rawValue) {
    if (rawValue === 1 || rawValue === 'IMAGE' || rawValue === 'image') return 'Image'
    if (rawValue === 8 || rawValue === 'CAROUSEL' || rawValue === 'carousel') return 'Carousel'
    if (rawValue === 2 || rawValue === 'VIDEO' || rawValue === 'video') return 'Video'
    return 'Video'
  }

  // ──────────────────────────────────────────────────────────────────────
  // /user_id_by_username — user ID resolution + parser
  // ──────────────────────────────────────────────────────────────────────

  // Resolve username → user_id. Used by getProfile, getReels (via getProfile
  // for getAnalytics). Throws descriptive error listing every candidate path
  // checked when nothing matches.
  async _resolveUserId(username) {
    if (!username) return ''
    const normalized = username.trim().toLowerCase()
    if (this.userIdCache.has(normalized)) {
      this._logDebug(`_resolveUserId hit cache for "${normalized}"`, { userId: this.userIdCache.get(normalized) })
      return this.userIdCache.get(normalized)
    }

    const body = await this._httpGet(
      '/user_id_by_username',
      { username: normalized },
      'resolveUserId'
    )
    const userId = this._firstByPath(body, USER_ID_CANDIDATES)
    if (!this._hasValue(userId)) {
      throw new Error(
        `RapidApiProvider._resolveUserId: could not extract user_id from ` +
        `/user_id_by_username response for username "${normalized}". ` +
        `Checked candidate paths: ${USER_ID_CANDIDATES.join(', ')}. ` +
        `Enable DEBUG_RAPIDAPI=true to inspect the raw payload logged as ` +
        `"GET resolveUserId response".`
      )
    }
    const resolvedId = String(userId)
    this.userIdCache.set(normalized, resolvedId)
    return resolvedId
  }

  // ──────────────────────────────────────────────────────────────────────
  // /profile — dedicated parser
  // ──────────────────────────────────────────────────────────────────────

  // Parse /profile response into the public getProfile return shape. Throws
  // descriptive error when required accountId cannot be located.
  _buildProfileResult(body, fallbackUsername, userId) {
    const data = this._unwrapDataObject(body)
    const accountId = this._firstByPath(data, PROFILE_FIELD_CANDIDATES.accountId)
    if (!this._hasValue(accountId)) {
      throw new Error(
        `RapidApiProvider.getProfile: could not parse /profile response for ` +
        `username "${fallbackUsername}" (user_id: ${userId}). ` +
        `Checked accountId candidate paths: ` +
        `${PROFILE_FIELD_CANDIDATES.accountId.join(', ')}. ` +
        `Enable DEBUG_RAPIDAPI=true to inspect the raw payload logged as ` +
        `"GET getProfile.profile response".`
      )
    }

    return {
      username: this._firstByPath(data, PROFILE_FIELD_CANDIDATES.username) || fallbackUsername,
      fullName: this._firstByPath(data, PROFILE_FIELD_CANDIDATES.fullName) || '',
      bio: this._firstByPath(data, PROFILE_FIELD_CANDIDATES.bio) || '',
      profilePic: this._firstByPath(data, PROFILE_FIELD_CANDIDATES.profilePic) || '',
      followers: this._firstByPath(data, PROFILE_FIELD_CANDIDATES.followers) ?? 0,
      following: this._firstByPath(data, PROFILE_FIELD_CANDIDATES.following) ?? 0,
      postsCount: this._firstByPath(data, PROFILE_FIELD_CANDIDATES.postsCount) ?? 0,
      verified: !!this._firstByPath(data, PROFILE_FIELD_CANDIDATES.verified),
      accountId: String(accountId),
      isMock: false,
      source: 'rapidapi',
      rawPayload: body,
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // /reels — dedicated parser
  // ──────────────────────────────────────────────────────────────────────

  // Locate the items array in a /reels response. Returns null when no
  // candidate path matches (caller raises a descriptive error).
  _extractReelItems(body) {
    for (const p of REEL_ITEMS_ARRAY_CANDIDATES) {
      const v = this._getPath(body, p)
      if (Array.isArray(v)) return v
    }
    return null
  }

  // Parse one reel item into the public contract shape. Handles GraphQL
  // `.node` unwrapping. Returns null when no reelId candidate matches —
  // caller filters nulls out.
  _parseReelItem(item) {
    const node = item?.node && typeof item.node === 'object' ? item.node : item
    if (!node || typeof node !== 'object') return null

    const reelId = this._firstByPath(node, REEL_FIELD_CANDIDATES.reelId)
    if (!this._hasValue(reelId)) return null

    const caption = this._firstByPath(node, REEL_FIELD_CANDIDATES.caption) || ''
    const mediaTypeRaw = this._firstByPath(node, REEL_FIELD_CANDIDATES.mediaType)
    const timestampCandidates = REEL_FIELD_CANDIDATES.timestamp.map(p => this._getPath(node, p))

    return {
      reelId: String(reelId),
      caption,
      views: this._firstByPath(node, REEL_FIELD_CANDIDATES.views) ?? 0,
      likes: this._firstByPath(node, REEL_FIELD_CANDIDATES.likes) ?? 0,
      comments: this._firstByPath(node, REEL_FIELD_CANDIDATES.comments) ?? 0,
      publishDate: this._parseTimestamp(...timestampCandidates),
      mediaType: this._mapMediaType(mediaTypeRaw),
      isMock: false,
      source: 'rapidapi',
      rawPayload: node,
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // /comments — dedicated parser
  // ──────────────────────────────────────────────────────────────────────

  _extractCommentItems(body) {
    for (const p of COMMENT_ITEMS_ARRAY_CANDIDATES) {
      const v = this._getPath(body, p)
      if (Array.isArray(v)) return v
    }
    return null
  }

  _parseCommentItem(item) {
    const node = item?.node && typeof item.node === 'object' ? item.node : item
    if (!node || typeof node !== 'object') return null

    const commentId = this._firstByPath(node, COMMENT_FIELD_CANDIDATES.commentId)
    if (!this._hasValue(commentId)) return null

    return {
      commentId: String(commentId),
      text: this._firstByPath(node, COMMENT_FIELD_CANDIDATES.text) || '',
      author: this._firstByPath(node, COMMENT_FIELD_CANDIDATES.author) || 'Anonymous',
      sentiment: 'neutral',
      isMock: false,
      source: 'rapidapi',
      rawPayload: node,
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Pagination strategies — one dedicated helper per strategy.
  // Each returns { cursor, type } on match, or null. Shared by reels and
  // comments pagination via the coordinator below.
  // ──────────────────────────────────────────────────────────────────────

  _tryMaxIdPagination(body) {
    const value = this._firstByPath(body, PAGINATION_MAX_ID_CANDIDATES)
    return this._hasValue(value) ? { cursor: String(value), type: 'max_id' } : null
  }

  _tryCursorPagination(body) {
    const value = this._firstByPath(body, PAGINATION_CURSOR_CANDIDATES)
    return this._hasValue(value) ? { cursor: String(value), type: 'cursor' } : null
  }

  _tryPageInfoPagination(body) {
    for (const p of PAGINATION_PAGE_INFO_CANDIDATES) {
      const pi = this._getPath(body, p)
      if (pi && typeof pi === 'object' && pi.has_next_page && this._hasValue(pi.end_cursor)) {
        return { cursor: String(pi.end_cursor), type: 'cursor' }
      }
    }
    return null
  }

  _tryMoreFlagPagination(body) {
    for (const pair of PAGINATION_MORE_FLAG_PAIRS) {
      const flag = this._getPath(body, pair.flag)
      if (flag === true) {
        const cursor = this._getPath(body, pair.cursorField)
        if (this._hasValue(cursor)) {
          return { cursor: String(cursor), type: pair.type }
        }
      }
    }
    return null
  }

  _tryNextUrlPagination(body) {
    const value = this._firstByPath(body, PAGINATION_NEXT_URL_CANDIDATES)
    return this._hasValue(value) ? { cursor: value, type: 'next_url' } : null
  }

  // Coordinator — try every strategy in priority order. Used by both reels
  // and comments pagination loops.
  _extractNextCursor(body) {
    if (!body || typeof body !== 'object') return { cursor: null, type: null }
    return (
      this._tryMaxIdPagination(body) ||
      this._tryCursorPagination(body) ||
      this._tryPageInfoPagination(body) ||
      this._tryMoreFlagPagination(body) ||
      this._tryNextUrlPagination(body) || { cursor: null, type: null }
    )
  }

  // Convert a (cursor, type) pair into the query param to send on the next
  // request. Returns null when no param applies (e.g. next_url type requires
  // URL-follow support that is not yet wired).
  _buildPaginationParam(cursor, type) {
    if (!cursor || !type) return null
    if (type === 'max_id') return { key: 'max_id', value: cursor }
    if (type === 'cursor') return { key: 'cursor', value: cursor }
    if (type === 'offset') return { key: 'offset', value: cursor }
    return null
  }

  // ──────────────────────────────────────────────────────────────────────
  // Paginated fetchers — orchestration only, no parsing inline.
  // ──────────────────────────────────────────────────────────────────────

  async _fetchAllReels(userId) {
    const allReels = []
    let cursor = null
    let cursorType = null
    let pagesFetched = 0

    while (pagesFetched < this.maxPages) {
      const params = { user_id: userId }
      const nextParam = this._buildPaginationParam(cursor, cursorType)
      if (nextParam) params[nextParam.key] = nextParam.value

      const body = await this._httpGet('/reels', params, `getReels.page[${pagesFetched}]`)
      const items = this._extractReelItems(body)
      if (items === null) {
        throw new Error(
          `RapidApiProvider.getReels: could not extract items array from ` +
          `/reels response for user_id "${userId}" on page ${pagesFetched}. ` +
          `Checked candidate paths: ${REEL_ITEMS_ARRAY_CANDIDATES.join(', ')}. ` +
          `Enable DEBUG_RAPIDAPI=true to inspect the raw payload logged as ` +
          `"GET getReels.page[N] response".`
        )
      }
      for (const item of items) {
        const parsed = this._parseReelItem(item)
        if (parsed) allReels.push(parsed)
      }

      const next = this._extractNextCursor(body)
      if (!next.cursor || next.cursor === cursor) break
      cursor = next.cursor
      cursorType = next.type
      pagesFetched++
    }

    if (pagesFetched >= this.maxPages) {
      this._logDebug(`getReels reached MAX_PAGES safety cap`, {
        userId, pagesFetched, reelsCount: allReels.length,
      })
    }
    return allReels
  }

  async _fetchAllReelsPost(username) {
    const allReels = []
    let cursor = ''
    let pagesFetched = 0

    while (pagesFetched < this.maxPages) {
      const bodyData = { username }
      if (cursor) {
        bodyData.maxId = cursor
      }

      let body
      try {
        body = await this._httpPost('/api/instagram/reels', bodyData, `getReels.page[${pagesFetched}]`)
      } catch (err) {
        if (allReels.length > 0) {
          this._logDebug(`getReels pagination failed at page ${pagesFetched}, returning ${allReels.length} reels`, err.message)
          break
        }
        throw err
      }
      const items = this._extractReelItems(body)
      if (items === null) {
        throw new Error(
          `RapidApiProvider.getReels: could not extract items array from ` +
          `/api/instagram/reels response for username "${username}" on page ${pagesFetched}. ` +
          `Checked candidate paths: ${REEL_ITEMS_ARRAY_CANDIDATES.join(', ')}. ` +
          `Enable DEBUG_RAPIDAPI=true to inspect the raw payload logged as ` +
          `"POST getReels.page[N] response".`
        )
      }
      for (const item of items) {
        const parsed = this._parseReelItem(item)
        if (parsed) allReels.push(parsed)
      }

      const nextHasPage = this._getPath(body, 'result.page_info.has_next_page')
      const nextCursor = this._getPath(body, 'result.page_info.end_cursor')
      
      if (!nextHasPage || !nextCursor || nextCursor === cursor) break
      cursor = nextCursor
      pagesFetched++
    }

    if (pagesFetched >= this.maxPages) {
      this._logDebug(`getReels reached MAX_PAGES safety cap`, {
        username, pagesFetched, reelsCount: allReels.length,
      })
    }
    return allReels
  }

  async _fetchAllComments(reelId) {
    const allComments = []
    let cursor = null
    let cursorType = null
    let pagesFetched = 0

    // Instagram media IDs returned by the /reels endpoint are compound strings
    // in the form "<mediaId>_<userId>" (e.g. "3940192134391524486_59856346363").
    // The /comments endpoint only accepts the pure numeric mediaId prefix.
    // Sending the full compound form returns HTTP 400.
    const mediaId = String(reelId).split('_')[0]

    while (pagesFetched < this.maxPages) {
      const params = { media_id: mediaId }
      const nextParam = this._buildPaginationParam(cursor, cursorType)
      if (nextParam) params[nextParam.key] = nextParam.value

      const body = await this._httpGet('/comments', params, `getComments.page[${pagesFetched}]`)
      const items = this._extractCommentItems(body)
      if (items === null) {
        throw new Error(
          `RapidApiProvider.getComments: could not extract items array from ` +
          `/comments response for media_id "${reelId}" on page ${pagesFetched}. ` +
          `Checked candidate paths: ${COMMENT_ITEMS_ARRAY_CANDIDATES.join(', ')}. ` +
          `Enable DEBUG_RAPIDAPI=true to inspect the raw payload logged as ` +
          `"GET getComments.page[N] response".`
        )
      }
      for (const item of items) {
        const parsed = this._parseCommentItem(item)
        if (parsed) allComments.push(parsed)
      }

      const next = this._extractNextCursor(body)
      if (!next.cursor || next.cursor === cursor) break
      cursor = next.cursor
      cursorType = next.type
      pagesFetched++
    }

    if (pagesFetched >= this.maxPages) {
      this._logDebug(`getComments reached MAX_PAGES safety cap`, {
        reelId, pagesFetched, commentsCount: allComments.length,
      })
    }
    return allComments
  }

  /**
   * Fetch comments via POST for instagram120.p.rapidapi.com host.
   * The host accepts: POST /api/instagram/comments { media_id: "..." }
   * with optional maxId for pagination.
   * On any error, returns [] (no mock fallback).
   */
  async _fetchAllCommentsPost(reelId) {
    const allComments = []
    let cursor = ''
    let pagesFetched = 0

    // Use only the numeric prefix, same as _fetchAllComments
    const mediaId = String(reelId).split('_')[0]

    while (pagesFetched < this.maxPages) {
      const bodyData = { media_id: mediaId }
      if (cursor) bodyData.maxId = cursor

      let body
      try {
        body = await this._httpPost('/api/instagram/comments', bodyData, `getComments.page[${pagesFetched}]`)
      } catch (err) {
        if (allComments.length > 0) {
          // Partial result is fine — pagination error on subsequent page
          this._logDebug(`getComments[instagram120] pagination error at page ${pagesFetched}`, err.message)
          break
        }
        // First page failed. Log a warning and return [] — do NOT fabricate data.
        console.warn(`[RapidApiProvider] instagram120 /api/instagram/comments failed for media_id ${mediaId}: ${err.message}`)
        return []
      }

      const items = this._extractCommentItems(body)
      if (items === null) {
        // API returned a response but with no recognisable comments array.
        // Could be an empty post or an unsupported shape. Return what we have.
        this._logDebug(`getComments[instagram120] no items array found on page ${pagesFetched}`, body)
        break
      }
      for (const item of items) {
        const parsed = this._parseCommentItem(item)
        if (parsed) allComments.push(parsed)
      }

      // instagram120 uses page_info.end_cursor / has_next_page like the reels endpoint
      const nextHasPage = this._getPath(body, 'result.page_info.has_next_page')
      const nextCursor  = this._getPath(body, 'result.page_info.end_cursor')
      if (!nextHasPage || !nextCursor || nextCursor === cursor) break
      cursor = nextCursor
      pagesFetched++
    }

    if (pagesFetched >= this.maxPages) {
      this._logDebug(`getComments[instagram120] reached MAX_PAGES safety cap`, {
        reelId, pagesFetched, commentsCount: allComments.length,
      })
    }
    return allComments
  }

  // ──────────────────────────────────────────────────────────────────────
  // /analytics — derived-result builder. Aggregation only; no parsing.
  // ──────────────────────────────────────────────────────────────────────

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
      source: 'rapidapi',
      rawPayload: { totalReelsCounted: reels.length },
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Public API — orchestration only. No parsing lives here.
  // ──────────────────────────────────────────────────────────────────────

  async getProfile(username) {
    if (!this._isConfigured()) {
      throw new Error('RapidApiProvider not configured: RAPIDAPI_KEY or RAPIDAPI_HOST missing')
    }
    if (this._isInstagram120()) {
      const body = await this._httpPost(
        '/api/instagram/profile',
        { username },
        'getProfile.profile'
      )
      const userId = this._firstByPath(body, USER_ID_CANDIDATES) || ''
      return this._buildProfileResult(body, username, userId)
    }

    const userId = await this._resolveUserId(username)
    const body = await this._httpGet(
      '/profile',
      { user_id: userId },
      'getProfile.profile'
    )
    return this._buildProfileResult(body, username, userId)
  }

  async getReels(username) {
    if (!this._isConfigured()) {
      throw new Error('RapidApiProvider not configured: RAPIDAPI_KEY or RAPIDAPI_HOST missing')
    }
    if (this._isInstagram120()) {
      return this._fetchAllReelsPost(username)
    }
    const userId = await this._resolveUserId(username)
    return this._fetchAllReels(userId)
  }

  async getComments(reelId) {
    if (!this._isConfigured()) {
      throw new Error('RapidApiProvider not configured: RAPIDAPI_KEY or RAPIDAPI_HOST missing')
    }
    if (this._isInstagram120()) {
      // instagram120 host supports comments via POST /api/instagram/comments
      return this._fetchAllCommentsPost(reelId)
    }
    return this._fetchAllComments(reelId)
  }

  async getAnalytics(username) {
    if (!this._isConfigured()) {
      throw new Error('RapidApiProvider not configured: RAPIDAPI_KEY or RAPIDAPI_HOST missing')
    }
    const profile = await this.getProfile(username)
    const reels = await this.getReels(username)
    return this._buildAnalyticsResult(profile, reels)
  }

  async healthCheck() {
    if (!this._isConfigured()) {
      return {
        status: 'unconfigured',
        provider: 'rapidapi',
        message: 'No API keys provided.',
      }
    }
    try {
      if (this._isInstagram120()) {
        await this._httpPost(
          '/api/instagram/profile',
          { username: 'instagram' },
          'healthCheck'
        )
      } else {
        await this._httpGet(
          '/user_id_by_username',
          { username: 'instagram' },
          'healthCheck'
        )
      }
      return { status: 'healthy', provider: 'rapidapi' }
    } catch (err) {
      return {
        status: 'degraded',
        provider: 'rapidapi',
        error: err.message,
        statusCode: err.status,
      }
    }
  }
}
