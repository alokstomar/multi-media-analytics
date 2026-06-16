/**
 * Unified analytics data shape.
 * All platform services should map their raw responses to this format.
 *
 * @typedef {Object} UnifiedMetrics
 * @property {string}  platform   - "youtube" | "instagram"
 * @property {number}  views
 * @property {number}  likes
 * @property {number}  comments
 * @property {number}  engagement - engagement rate (0–100)
 * @property {number}  followers  - subscribers (YouTube) or followers (Instagram)
 * @property {string}  date       - ISO date string
 */

export function normalizeYouTubeData(raw) {
  // TODO: map YouTube API response → UnifiedMetrics
  return {
    platform: 'youtube',
    views: 0,
    likes: 0,
    comments: 0,
    engagement: 0,
    followers: 0,
    date: '',
  }
}

export function normalizeInstagramData(raw) {
  // TODO: map Instagram API response → UnifiedMetrics
  return {
    platform: 'instagram',
    views: 0,
    likes: 0,
    comments: 0,
    engagement: 0,
    followers: 0,
    date: '',
  }
}
