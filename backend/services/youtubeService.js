import axios from 'axios'
import { AppError } from '../utils/errorHandler.js'

const BASE = 'https://www.googleapis.com/youtube/v3'

function yt() {
  return axios.create({
    baseURL: BASE,
    params: { key: process.env.YOUTUBE_API_KEY },
  })
}

// ── Detect input type ──────────────────────────────────────
export function detectInput(input) {
  const trimmed = input.trim()

  // Direct channel ID: UC...
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return { type: 'id', value: trimmed }
  }

  // @handle
  if (trimmed.startsWith('@')) {
    return { type: 'handle', value: trimmed }
  }

  // Full URL — extract handle or channel ID from it
  const urlHandle = trimmed.match(/youtube\.com\/@([\w.-]+)/)
  if (urlHandle) return { type: 'handle', value: `@${urlHandle[1]}` }

  const urlChannel = trimmed.match(/youtube\.com\/channel\/(UC[\w-]{22})/)
  if (urlChannel) return { type: 'id', value: urlChannel[1] }

  const urlCustom = trimmed.match(/youtube\.com\/c\/([\w.-]+)/)
  if (urlCustom) return { type: 'custom', value: urlCustom[1] }

  const urlUser = trimmed.match(/youtube\.com\/user\/([\w.-]+)/)
  if (urlUser) return { type: 'user', value: urlUser[1] }

  // Plain text — treat as search query
  return { type: 'search', value: trimmed }
}

// ── Resolve any input to a channelId ──────────────────────
export async function resolveChannelId(input) {
  const { type, value } = detectInput(input)
  const api = yt()

  if (type === 'id') return value

  if (type === 'handle') {
    const { data } = await api.get('/channels', {
      params: { part: 'id', forHandle: value },
    })
    if (data.items?.[0]) return data.items[0].id
  }

  if (type === 'user') {
    const { data } = await api.get('/channels', {
      params: { part: 'id', forUsername: value },
    })
    if (data.items?.[0]) return data.items[0].id
  }

  // search / custom — use search endpoint
  const { data } = await api.get('/search', {
    params: {
      part: 'snippet',
      q: value,
      type: 'channel',
      maxResults: 1,
    },
  })
  if (data.items?.[0]) return data.items[0].snippet.channelId

  throw new AppError('Channel not found', 404)
}

// ── Fetch full channel details ─────────────────────────────
export async function fetchChannelDetails(channelId) {
  const api = yt()
  const resp = await api.get('/channels', {
    params: {
      part: 'snippet,statistics,brandingSettings',
      id: channelId,
    },
  })

  const item = resp.data.items?.[0]
  if (!item) throw new AppError('Channel not found', 404)

  const s = item.statistics
  const sn = item.snippet
  const br = item.brandingSettings?.image

  return {
    channelId: item.id,
    title: sn.title,
    handle: sn.customUrl || null,
    profileImage: sn.thumbnails?.high?.url || sn.thumbnails?.default?.url,
    banner: br?.bannerExternalUrl || null,
    description: sn.description,
    country: sn.country || item.brandingSettings?.channel?.country || null,
    subscribers: Number(s.subscriberCount) || 0,
    totalViews: Number(s.viewCount) || 0,
    totalVideos: Number(s.videoCount) || 0,
  }
}

// ── Fetch channel videos ──────────────────────────────────
export async function fetchChannelVideos(channelId, maxResults = 20) {
  const api = yt()

  // Step 1: get uploads playlist ID
  const chResp = await api.get('/channels', {
    params: { part: 'contentDetails', id: channelId },
  })

  const uploadsId = chResp.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsId) throw new AppError('Uploads playlist not found', 404)

  // Step 2: get video IDs from playlist
  const plResp = await api.get('/playlistItems', {
    params: {
      part: 'snippet',
      playlistId: uploadsId,
      maxResults,
    },
  })

  const videoIds = plResp.data.items
    .map((i) => i.snippet.resourceId?.videoId)
    .filter(Boolean)

  if (!videoIds.length) return []

  // Step 3: get video statistics
  const vidResp = await api.get('/videos', {
    params: {
      part: 'snippet,statistics',
      id: videoIds.join(','),
    },
  })

  return vidResp.data.items.map((v) => ({
    videoId: v.id,
    channelId,
    title: v.snippet.title,
    thumbnail: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.default?.url,
    publishedAt: v.snippet.publishedAt,
    views: Number(v.statistics.viewCount) || 0,
    likes: Number(v.statistics.likeCount) || 0,
    comments: Number(v.statistics.commentCount) || 0,
  }))
}

// ── Fetch video descriptions for Creator DNA analysis ─────────────────
// Pulls the full snippet.description for up to 50 video IDs per batch.
// Returns [{ videoId, description }] — an empty array on any failure so
// the caller degrades gracefully to titles-only analysis.
//
// Priority order for Creator DNA context assembly:
//   1. Video transcripts (future — picked up automatically when Video.transcript exists)
//   2. Video descriptions  ← this function provides this tier
//   3. Video titles
//   4. Channel description
export async function fetchVideoDescriptions(videoIds = []) {
  if (!videoIds.length) return []
  const api = yt()
  const results = []

  try {
    // YouTube allows up to 50 IDs per videos.list call
    const batches = []
    for (let i = 0; i < videoIds.length; i += 50) {
      batches.push(videoIds.slice(i, i + 50))
    }

    for (const batch of batches) {
      const { data } = await api.get('/videos', {
        params: {
          part: 'snippet',
          id: batch.join(','),
          fields: 'items(id,snippet(description))',
        },
      })
      for (const item of (data.items || [])) {
        const desc = (item.snippet?.description || '').trim()
        if (desc) {
          results.push({ videoId: item.id, description: desc })
        }
      }
    }
  } catch (err) {
    // Non-fatal — the DNA engine falls back to titles-only analysis
    console.warn('[YT] fetchVideoDescriptions failed (non-fatal):', err.message)
  }

  return results
}

/**
 * Fetch comment threads for a single video with optional nextPageToken pagination.
 * maxPages controls how many API pages to traverse (each page = up to 100 comments).
 */
export async function fetchVideoCommentThreads(videoId, { maxPerPage = 100, maxPages = 1 } = {}) {
  const api = yt()
  const allItems = []
  let pageToken = undefined
  let pagesRead = 0

  try {
    do {
      const params = {
        part: 'snippet',
        videoId,
        maxResults: Math.min(maxPerPage, 100),
        order: 'relevance',
      }
      if (pageToken) params.pageToken = pageToken

      const { data } = await api.get('/commentThreads', { params })

      if (!data.items?.length) break

      allItems.push(...data.items)
      pageToken = data.nextPageToken || null
      pagesRead++
    } while (pageToken && pagesRead < maxPages)
  } catch (err) {
    console.error(`  [YT] Failed to fetch comments for video ${videoId}: ${err.message}`)
    return []
  }

  return allItems.map((item) => {
    const top = item.snippet?.topLevelComment
    const c = top?.snippet || {}
    return {
      commentId: top?.id || item.id,
      videoId: c.videoId || videoId,
      authorDisplayName: c.authorDisplayName || 'Anonymous',
      authorProfileImageUrl: c.authorProfileImageUrl || null,
      text: c.textOriginal || c.textDisplay || '',
      publishedAt: c.publishedAt ? new Date(c.publishedAt) : new Date(),
      likeCount: Number(c.likeCount) || 0,
    }
  })
}

/**
 * Fetch comments across multiple videos of a channel.
 *
 * @param {string} channelId
 * @param {object} opts
 * @param {number} opts.maxVideos       - how many latest videos to scan (5 | 10 | 25)
 * @param {number} opts.maxPagesPerVideo - YouTube API pages per video (1 page = up to 100 comments)
 */
export async function fetchChannelComments(channelId, { maxVideos = 10, maxPagesPerVideo = 1 } = {}) {
  const videos = await fetchChannelVideos(channelId, maxVideos)
  console.log(`  [YT] Found ${videos.length} videos for channel ${channelId}`)

  const allComments = []
  let apiCalls = 0

  for (const video of videos) {
    if (video.comments === 0) continue // Skip videos with comments disabled
    const threads = await fetchVideoCommentThreads(video.videoId, {
      maxPerPage: 100,
      maxPages: maxPagesPerVideo,
    })
    apiCalls += Math.ceil(threads.length / 100) || 1
    if (threads.length) {
      allComments.push(...threads)
      console.log(`  [YT] Video "${video.title?.slice(0, 40)}...": ${threads.length} comments`)
    }
  }

  console.log(`  [YT] Total: ${allComments.length} comments from ${videos.length} videos (${apiCalls} API calls)`)
  return { comments: allComments, videosScanned: videos.length, apiCalls }
}
