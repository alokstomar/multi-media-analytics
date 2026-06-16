/**
 * Analytics engine — computes metrics from channel + video data.
 * All functions are pure: data in, numbers out.
 */

// ── Engagement Rate ────────────────────────────────────────
// (likes + comments) / views * 100
export function engagementRate(videos) {
  if (!videos.length) return 0
  const total = videos.reduce((s, v) => s + v.views, 0)
  if (total === 0) return 0
  const engaged = videos.reduce((s, v) => s + v.likes + v.comments, 0)
  return parseFloat(((engaged / total) * 100).toFixed(2))
}

// ── Average Views ──────────────────────────────────────────
export function averageViews(videos) {
  if (!videos.length) return 0
  const total = videos.reduce((s, v) => s + v.views, 0)
  return Math.round(total / videos.length)
}

// ── Upload Frequency (videos per week) ─────────────────────
export function uploadFrequency(videos) {
  if (videos.length < 2) return 0
  const dates = videos.map((v) => new Date(v.publishedAt)).sort()
  const newest = dates[dates.length - 1]
  const oldest = dates[0]
  const weeks = (newest - oldest) / (7 * 24 * 60 * 60 * 1000)
  if (weeks === 0) return videos.length
  return parseFloat((videos.length / weeks).toFixed(2))
}

// ── Best Performing Video ──────────────────────────────────
export function bestPerforming(videos) {
  if (!videos.length) return null
  return videos.reduce((best, v) => (v.views > best.views ? v : best), videos[0])
}

// ── Worst Performing Video ─────────────────────────────────
export function worstPerforming(videos) {
  if (!videos.length) return null
  return videos.reduce((worst, v) => (v.views < worst.views ? v : worst), videos[0])
}

// ── Views Growth ───────────────────────────────────────────
// Compares recent half vs older half of videos
export function viewsGrowth(videos) {
  if (videos.length < 2) return 0
  const sorted = [...videos].sort(
    (a, b) => new Date(a.publishedAt) - new Date(b.publishedAt),
  )
  const mid = Math.floor(sorted.length / 2)
  const older = sorted.slice(0, mid)
  const newer = sorted.slice(mid)
  const olderViews = older.reduce((s, v) => s + v.views, 0)
  const newerViews = newer.reduce((s, v) => s + v.views, 0)
  if (olderViews === 0) return newerViews > 0 ? 100 : 0
  return parseFloat((((newerViews - olderViews) / olderViews) * 100).toFixed(2))
}

// ── Subscriber Growth Estimate ─────────────────────────────
// Based on engagement trend (since YT API requires auth for sub history)
export function subscriberGrowthEstimate(videos) {
  const avgEng = engagementRate(videos)
  const growth = viewsGrowth(videos)
  return parseFloat(((avgEng * 0.4 + growth * 0.6) / 2).toFixed(2))
}

// ── Traffic Sources (simulated) ────────────────────────────
// YouTube Analytics API needs OAuth, so we estimate from video patterns
export function estimateTrafficSources(videos) {
  if (!videos.length) return []

  const totalViews = videos.reduce((s, v) => s + v.views, 0)
  const avgViews = totalViews / videos.length
  const variance = videos.reduce((s, v) => s + Math.pow(v.views - avgViews, 2), 0) / videos.length
  const cv = avgViews > 0 ? Math.sqrt(variance) / avgViews : 0

  // High variance = more search-driven, low variance = more browse-driven
  const searchShare = Math.min(55, Math.max(25, 30 + cv * 40))
  const remaining = 100 - searchShare

  return [
    { name: 'YouTube Search', value: parseFloat(searchShare.toFixed(1)), color: '#3B82F6' },
    { name: 'Browse Features', value: parseFloat((remaining * 0.42).toFixed(1)), color: '#8B5CF6' },
    { name: 'Suggested Videos', value: parseFloat((remaining * 0.25).toFixed(1)), color: '#EF4444' },
    { name: 'External', value: parseFloat((remaining * 0.18).toFixed(1)), color: '#F59E0B' },
    { name: 'Others', value: parseFloat((remaining * 0.15).toFixed(1)), color: '#10B981' },
  ]
}

// ── Monthly Views Breakdown ────────────────────────────────
export function monthlyViewsBreakdown(videos) {
  if (!videos.length) return []

  const months = {}
  videos.forEach((v) => {
    const d = new Date(v.publishedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months[key] = (months[key] || 0) + v.views
  })

  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, views]) => ({ month, views }))
}

// ── Subscriber Growth Timeline ─────────────────────────────
export function subscriberGrowthTimeline(channel, videos) {
  if (!videos.length) return []

  const totalSubs = channel.subscribers
  const sorted = [...videos].sort(
    (a, b) => new Date(a.publishedAt) - new Date(b.publishedAt),
  )

  // Distribute subs across video timeline proportionally
  const totalViews = sorted.reduce((s, v) => s + v.views, 0)
  let accumulated = totalSubs * 0.6 // Assume 60% of subs came from these videos

  return sorted.map((v, i) => {
    const share = totalViews > 0 ? v.views / totalViews : 1 / sorted.length
    accumulated += totalSubs * 0.4 * share
    const date = new Date(v.publishedAt)
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      subscribers: Math.round(accumulated),
    }
  })
}

// ── Full Analytics Package ─────────────────────────────────
export function generateAnalytics(channel, videos) {
  return {
    overview: {
      subscribers: channel.subscribers,
      totalViews: channel.totalViews,
      totalVideos: channel.totalVideos,
      engagementRate: engagementRate(videos),
      averageViews: averageViews(videos),
      uploadFrequency: uploadFrequency(videos),
      viewsGrowth: viewsGrowth(videos),
    },
    trafficSources: estimateTrafficSources(videos).map((s) => ({ ...s, estimated: true })),
    subscribersGrowth: subscriberGrowthTimeline(channel, videos).map((s) => ({ ...s, estimated: true })),
    topVideos: [...videos].sort((a, b) => b.views - a.views).slice(0, 5),
    monthlyViews: monthlyViewsBreakdown(videos).map((m) => ({ ...m, estimated: false })),
    meta: {
      trafficSourcesEstimated: true,
      subscribersGrowthEstimated: true,
      retentionRequiresOAuth: true,
    },
  }
}
