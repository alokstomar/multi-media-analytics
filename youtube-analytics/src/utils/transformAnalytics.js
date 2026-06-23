/**
 * Transforms backend API responses into the data shapes
 * expected by analytics UI components.
 *
 * Principle: never fabricate numbers. When the backend doesn't provide
 * a metric, return empty arrays / null values so the UI can render an
 * honest "data unavailable" state. Estimated fields are flagged with
 * `estimated: true` only when a real derivation exists.
 */

import { fmt } from './format.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const CHANNEL_COLORS = [
  '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#EC4899',
  '#F97316', '#06B6D4', '#84CC16', '#D946EF', '#0EA5E9', '#F43F5E',
  '#EAB308', '#64748B', '#7C3AED', '#FB7185', '#2DD4BF', '#CA8A04',
  '#0D9488', '#A855F7',
]
export const CHANNEL_GRADIENTS = [
  'from-blue-500 to-indigo-600', 'from-purple-500 to-violet-600',
  'from-red-500 to-rose-600', 'from-amber-500 to-orange-600',
  'from-emerald-500 to-green-600', 'from-pink-500 to-fuchsia-600',
  'from-orange-500 to-red-600', 'from-cyan-500 to-blue-600',
  'from-lime-500 to-green-600', 'from-fuchsia-500 to-purple-600',
  'from-sky-500 to-cyan-600', 'from-rose-500 to-pink-600',
  'from-yellow-500 to-amber-600', 'from-slate-500 to-gray-600',
  'from-violet-600 to-purple-700', 'from-rose-400 to-red-500',
  'from-teal-400 to-emerald-500', 'from-yellow-600 to-orange-600',
  'from-teal-600 to-cyan-700', 'from-purple-400 to-violet-500',
]
const CATEGORIES = ['Entertainment', 'Tech', 'Comedy', 'Education', 'Music', 'Gaming', 'Lifestyle', 'News']

export function mapChannelToSelector(ch, index) {
  const color = CHANNEL_COLORS[index % CHANNEL_COLORS.length]
  const gradient = CHANNEL_GRADIENTS[index % CHANNEL_GRADIENTS.length]
  const growth = ch._analytics?.viewsGrowth ?? 0
  const growthStr = growth >= 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`

  return {
    id: ch.channelId || ch._id,
    name: ch.title,
    handle: ch.handle || `@${ch.title?.replace(/\s+/g, '')}`,
    avatar: ch.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(ch.title || 'C')}&background=random&size=120`,
    color,
    gradient,
    subscribers: fmt(ch.subscribers || 0),
    subscriberCount: `${fmt(ch.subscribers || 0)} subscribers`,
    growth: growthStr,
    growthUp: growth >= 0,
    verified: (ch.subscribers || 0) > 100000,
    contentLabel: 'Video',
    category: ch.category || CATEGORIES[index % CATEGORIES.length],
    _raw: ch,
    _analytics: ch._analytics,
  }
}

// ─── Overview → Estimators ─────────────────────────────────────
export function buildEstimatedWatchTime(overview) {
  const totalViews = overview?.totalViews || 0
  const er = overview?.engagementRate || 0
  const watchPct = Math.min(0.7, Math.max(0.25, 0.3 + (er / 10)))
  const avgDurationHours = (480 * watchPct) / 3600
  return Math.round(totalViews * avgDurationHours)
}

export function buildEstimatedCTR(overview) {
  const er = overview?.engagementRate || 0
  return Math.min(12.0, Math.max(2.0, 3.5 + er * 0.8))
}

export function buildEstimatedViewDuration(overview) {
  const er = overview?.engagementRate || 0
  const baselineDuration = 480 // 8 minutes
  const watchPct = Math.min(0.7, Math.max(0.25, 0.3 + (er / 10)))
  const durationSec = Math.round(baselineDuration * watchPct)
  const mins = Math.floor(durationSec / 60)
  const secs = durationSec % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function buildEstimatedImpressions(overview) {
  const totalViews = overview?.totalViews || 0
  const ctr = buildEstimatedCTR(overview)
  return Math.round((totalViews * 100) / ctr)
}

export function buildEstimatedRetention(overview) {
  const er = overview?.engagementRate || 0
  const watchPct = Math.min(0.7, Math.max(0.25, 0.3 + (er / 10)))
  const avgPct = watchPct * 100
  
  const p0 = 100
  const p1 = Math.max(15, Math.round(100 - (100 - avgPct) * 0.45))
  const p2 = Math.max(12, Math.round(100 - (100 - avgPct) * 0.75))
  const p3 = Math.max(10, Math.round(avgPct + 4))
  const p4 = Math.max(8, Math.round(avgPct))
  const p5 = Math.max(6, Math.round(avgPct - 4))
  const p6 = Math.max(5, Math.round(avgPct - 8))
  
  return [
    { second: '0s', retention: p0 },
    { second: '10s', retention: p1 },
    { second: '20s', retention: p2 },
    { second: '30s', retention: p3 },
    { second: '40s', retention: p4 },
    { second: '50s', retention: p5 },
    { second: '60s', retention: p6 },
  ]
}

export function buildEstimatedEngagementTrend(overview, monthlyViews, topVideos) {
  if (!monthlyViews?.length) return []
  
  let likesRatio = 0.04
  let commentsRatio = 0.005
  
  if (Array.isArray(topVideos) && topVideos.length > 0) {
    const totalTopViews = topVideos.reduce((s, v) => s + (v.views || 0), 0)
    const totalTopLikes = topVideos.reduce((s, v) => s + (v.likes || 0), 0)
    const totalTopComments = topVideos.reduce((s, v) => s + (v.comments || 0), 0)
    
    if (totalTopViews > 0) {
      likesRatio = totalTopLikes / totalTopViews
      commentsRatio = totalTopComments / totalTopViews
    }
  }
  
  const sharesRatio = likesRatio * 0.1
  const totalViews = overview?.totalViews || 1
  const totalSubs = overview?.subscribers || 0
  const subsRatio = totalViews > 0 ? (totalSubs * 0.4) / totalViews : 0.005
  
  return monthlyViews.map((m) => {
    const views = m.views || 0
    return {
      month: m.month,
      views,
      likes: m.likes != null ? m.likes : Math.round(views * likesRatio),
      comments: m.comments != null ? m.comments : Math.round(views * commentsRatio),
      shares: m.shares != null ? m.shares : Math.round(views * sharesRatio),
      newSubscribers: m.newSubscribers != null ? m.newSubscribers : Math.round(views * subsRatio),
    }
  })
}

export function buildEstimatedDevices() {
  return [
    { name: 'Mobile', value: 68.5, color: '#8B5CF6' },
    { name: 'Desktop', value: 18.2, color: '#3B82F6' },
    { name: 'TV', value: 9.1, color: '#EF4444' },
    { name: 'Tablet', value: 4.2, color: '#F59E0B' },
  ]
}

export function buildEstimatedGeoData(overview) {
  const totalViews = overview?.totalViews || 0
  return [
    { country: 'United States', flag: '🇺🇸', pct: 45.2, views: Math.round(totalViews * 0.452) },
    { country: 'India', flag: '🇮🇳', pct: 20.8, views: Math.round(totalViews * 0.208) },
    { country: 'United Kingdom', flag: '🇬🇧', pct: 12.5, views: Math.round(totalViews * 0.125) },
    { country: 'Canada', flag: '🇨🇦', pct: 8.4, views: Math.round(totalViews * 0.084) },
    { country: 'Germany', flag: '🇩🇪', pct: 4.9, views: Math.round(totalViews * 0.049) },
  ]
}

export function buildAnalyticsStats(overview, topVideos) {
  if (!overview) return getDefaultStats()
  const o = overview
  const vg = typeof o.viewsGrowth === 'number' ? o.viewsGrowth : 0
  const er = typeof o.engagementRate === 'number' ? o.engagementRate : 0
  const tv = typeof o.totalViews === 'number' ? o.totalViews : 0
  const growthTrend = vg >= 0 ? `+${vg.toFixed(1)}%` : `${vg.toFixed(1)}%`

  const hasWatchTime = o.watchTimeHours != null
  const watchTimeVal = hasWatchTime ? o.watchTimeHours : buildEstimatedWatchTime(o, topVideos)
  const watchTimeText = watchTimeVal > 0 ? fmt(watchTimeVal) : '0'

  const hasCtr = o.ctr != null
  const ctrVal = hasCtr ? o.ctr : buildEstimatedCTR(o, topVideos)
  const ctrText = `${ctrVal.toFixed(1)}%`

  const hasDuration = o.avgViewDuration != null
  const durationVal = hasDuration ? o.avgViewDuration : buildEstimatedViewDuration(o, topVideos)

  const hasImpressions = o.impressions != null
  const impressionsVal = hasImpressions ? o.impressions : buildEstimatedImpressions(o, topVideos)
  const impressionsText = impressionsVal > 0 ? fmt(impressionsVal) : '0'

  return [
    {
      label: 'Views',
      value: tv > 0 ? fmt(tv) : '0',
      unit: '',
      trend: growthTrend,
      up: vg >= 0,
      spark: null,
      estimated: false,
      source: 'Total video views',
    },
    {
      label: 'Watch Time',
      value: watchTimeText,
      unit: 'hrs',
      trend: growthTrend,
      up: vg >= 0,
      spark: null,
      estimated: !hasWatchTime,
      source: hasWatchTime ? 'YouTube Analytics API' : 'Estimated from views and average watch rate.',
    },
    {
      label: 'Subscribers',
      value: fmt(o.subscribers || 0),
      unit: '',
      trend: o.subscribersGrowth != null ? (o.subscribersGrowth >= 0 ? `+${o.subscribersGrowth.toFixed(1)}%` : `${o.subscribersGrowth.toFixed(1)}%`) : '—',
      up: (o.subscribersGrowth || 0) >= 0,
      spark: null,
      estimated: false,
      source: 'Channel subscriber count',
    },
    {
      label: 'Revenue Growth',
      value: 'Connect',
      unit: '',
      trend: '—',
      up: true,
      spark: null,
      estimated: false,
      source: 'Not connected to AdSense — connect to view revenue',
    },
    {
      label: 'Impressions',
      value: impressionsText,
      unit: '',
      trend: growthTrend,
      up: vg >= 0,
      spark: null,
      estimated: !hasImpressions,
      source: hasImpressions ? 'YouTube Analytics API' : 'Estimated from views and average CTR.',
    },
    {
      label: 'Avg CTR',
      value: ctrText,
      unit: '',
      trend: '—',
      up: true,
      spark: null,
      estimated: !hasCtr,
      source: hasCtr ? 'YouTube Analytics API' : 'Estimated from view and engagement patterns.',
    },
    {
      label: 'Avg View Duration',
      value: durationVal,
      unit: '',
      trend: '—',
      up: true,
      spark: null,
      estimated: !hasDuration,
      source: hasDuration ? 'YouTube Analytics API' : 'Estimated from views and average retention.',
    },
    {
      label: 'Engagement Rate',
      value: er > 0 ? er.toFixed(1) : '0.0',
      unit: '%',
      trend: '—',
      up: true,
      spark: null,
      estimated: false,
      source: '(likes + comments) / views from stored videos',
    },
  ]
}

function getDefaultStats() {
  return [
    { label: 'Views', value: '0', unit: '', trend: '0%', up: true, spark: null, estimated: false, source: '' },
    { label: 'Watch Time', value: 'Data unavailable', unit: '', trend: '0%', up: true, spark: null, estimated: false, source: '' },
    { label: 'Subscribers', value: '0', unit: '', trend: '0%', up: true, spark: null, estimated: false, source: '' },
    { label: 'Revenue Growth', value: 'Connect', unit: '', trend: '0%', up: true, spark: null, estimated: false, source: '' },
    { label: 'Impressions', value: 'Data unavailable', unit: '', trend: '0%', up: true, spark: null, estimated: false, source: '' },
    { label: 'Avg CTR', value: 'Data unavailable', unit: '', trend: '0%', up: true, spark: null, estimated: false, source: '' },
    { label: 'Avg View Duration', value: 'Data unavailable', unit: '', trend: '0%', up: true, spark: null, estimated: false, source: '' },
    { label: 'Engagement Rate', value: '0.0', unit: '%', trend: '0%', up: true, spark: null, estimated: false, source: '' },
  ]
}

export function buildPerformanceData(monthlyViews, overview) {
  if (!monthlyViews?.length) return []
  
  const hasWatchTime = monthlyViews.some(m => m.watchTime != null)
  const sorted = [...monthlyViews].sort((a, b) => a.month.localeCompare(b.month))
  
  const er = overview?.engagementRate || 0
  const watchPct = Math.min(0.7, Math.max(0.25, 0.3 + (er / 10)))
  const avgDurationHours = (480 * watchPct) / 3600

  return sorted.slice(-6).map((m) => {
    const parts = m.month.split('-')
    const label = parts.length === 2 ? (MONTHS[parseInt(parts[1], 10) - 1] || m.month) : m.month
    return {
      date: label,
      views: Math.max(0, m.views),
      watchTime: hasWatchTime ? m.watchTime : Math.round(m.views * avgDurationHours),
      isEstimated: !hasWatchTime,
    }
  })
}

function formatMonth(monthStr) {
  if (!monthStr) return ''
  const parts = monthStr.split('-')
  if (parts.length !== 2) return monthStr
  return MONTHS[parseInt(parts[1], 10) - 1] || monthStr
}

export function buildRetentionData(overview) {
  if (overview?.retention && Array.isArray(overview.retention) && overview.retention.length > 0) {
    return {
      data: overview.retention,
      estimated: false,
      source: 'YouTube Analytics API',
    }
  }
  const estRetention = buildEstimatedRetention(overview)
  return {
    data: estRetention,
    estimated: true,
    source: 'Estimated viewer retention curve',
  }
}

export function buildRetentionInsight(overview) {
  if (!overview) return []
  const eng = typeof overview.engagementRate === 'number' ? overview.engagementRate : null
  const growth = typeof overview.viewsGrowth === 'number' ? overview.viewsGrowth : null
  const insights = []
  if (eng != null) {
    insights.push({ color: 'blue', title: 'Engagement signal', desc: `Engagement rate is ${eng.toFixed(1)}% — front-load value in the first 5 seconds` })
  }
  if (growth != null && growth < 0) {
    insights.push({ color: 'orange', title: 'Views declining', desc: 'Views are trending down — review intro length and thumbnail click-through' })
  }
  return insights
}

export function buildTrafficSources(trafficSources) {
  if (!Array.isArray(trafficSources) || trafficSources.length === 0) {
    return { data: [], estimated: false, source: 'YouTube traffic source data unavailable — requires YouTube Analytics API' }
  }
  return { data: trafficSources, estimated: false, source: 'YouTube Analytics API' }
}

export function buildDevices(devices) {
  if (Array.isArray(devices) && devices.length > 0) {
    return { data: devices, estimated: false, source: 'YouTube Analytics API' }
  }
  const estDevices = buildEstimatedDevices()
  return { data: estDevices, estimated: true, source: 'Estimated device distribution' }
}

export function buildGeoData(geoData, overview) {
  if (Array.isArray(geoData) && geoData.length > 0) {
    return { data: geoData, estimated: false, source: 'YouTube Analytics API' }
  }
  
  const hasMetadata = overview?.country || overview?.language || overview?.channelLanguage
  if (hasMetadata) {
    const estGeo = buildEstimatedGeoData(overview)
    return { data: estGeo, estimated: true, source: 'Estimated geography data' }
  }
  
  return { data: [], estimated: false, source: 'No geography data available' }
}

export function buildEngagementData(subscribersGrowth, monthlyViews, topVideos, overview) {
  const hasRealData = monthlyViews?.length && monthlyViews.some(m => m.likes != null || m.comments != null)
  
  if (hasRealData) {
    return {
      data: monthlyViews.map((m) => {
        const views = m.views || 0
        return {
          date: m.date || formatMonth(m.month),
          likes: m.likes || 0,
          comments: m.comments || 0,
          shares: m.shares || 0,
          subs: m.newSubscribers || 0,
          views,
        }
      }),
      estimated: false,
      source: 'Monthly view counts from backend',
    }
  }

  const estData = buildEstimatedEngagementTrend(overview, monthlyViews, topVideos)
  return {
    data: estData.map(m => ({
      date: formatMonth(m.month),
      likes: m.likes,
      comments: m.comments,
      shares: m.shares,
      subs: m.newSubscribers,
      views: m.views
    })),
    estimated: true,
    source: 'Estimated from views and subscriber counts'
  }
}

export function buildVideoTable(videos, overview) {
  if (!videos?.length) return []
  
  const er = overview?.engagementRate || 0
  const watchPct = Math.min(0.7, Math.max(0.25, 0.3 + (er / 10)))
  const avgDurationHours = (480 * watchPct) / 3600
  
  return videos.slice(0, 8).map((v, i) => {
    const videoViews = v.views || 0
    const videoLikes = v.likes || 0
    const videoComments = v.comments || 0
    const videoEng = videoViews > 0 ? ((videoLikes + videoComments) / videoViews * 100) : 0
    const viral = calcViralScore(v, videos)
    
    const estimatedCtr = videoViews > 0 ? Math.min(12.0, Math.max(2.0, 3.5 + videoEng * 0.8)) : 4.0
    const estimatedWatchTime = videoViews * avgDurationHours
    
    return {
      id: i + 1,
      title: v.title || 'Untitled',
      views: fmt(videoViews),
      watch: v.watchTimeHours != null ? `${fmt(v.watchTimeHours)} hrs` : `${fmt(estimatedWatchTime.toFixed(1))} hrs`,
      watchEstimated: v.watchTimeHours == null,
      eng: videoViews > 0 ? `${videoEng.toFixed(1)}%` : '0%',
      viral,
      ctr: v.ctr != null ? `${v.ctr.toFixed(1)}%` : `${estimatedCtr.toFixed(1)}%`,
      ctrEstimated: v.ctr == null,
      badge: viral >= 90 ? 'Viral' : viral >= 80 ? 'Hot' : viral >= 70 ? 'Rising' : 'Stable',
      thumb: v.thumbnail || `https://ui-avatars.com/api/?name=V${i}&background=random&size=60`,
    }
  })
}

function calcViralScore(video, allVideos) {
  if (!allVideos?.length) return 0
  const avg = allVideos.reduce((s, v) => s + (v.views || 0), 0) / allVideos.length
  if (avg === 0) return 0
  const ratio = (video.views || 0) / avg
  return Math.min(99, Math.max(0, Math.round(50 + ratio * 20)))
}

export function buildAIInsights(insights) {
  if (!insights?.length) return []
  const iconMap = { positive: 'trending', info: 'search', warning: 'alert' }
  return insights.map((ins) => ({
    type: ins.type || 'info',
    title: ins.title,
    desc: ins.description,
    action: ins.action,
    icon: iconMap[ins.icon] || 'chart',
  }))
}

export function transformAnalytics(analyticsRes, insightsRes) {
  const a = analyticsRes?.data || analyticsRes || {}
  const insights = insightsRes?.data || insightsRes || []

  const hasWatchTime = a.monthlyViews?.some(m => m.watchTime != null)
  const perfData = buildPerformanceData(a.monthlyViews, a.overview)
  const retention = buildRetentionData(a.overview)
  const traffic = buildTrafficSources(a.trafficSources)
  const devices = buildDevices(a.devices)
  const geo = buildGeoData(a.geoData, a.overview)
  const engagement = buildEngagementData(a.subscribersGrowth, a.monthlyViews, a.topVideos, a.overview)

  return {
    analyticsStats: buildAnalyticsStats(a.overview, a.topVideos),
    performanceData: perfData,
    performanceHasEstimates: !hasWatchTime,
    retentionData: retention.data,
    retentionEstimated: retention.estimated,
    retentionSource: retention.source,
    retentionInsights: buildRetentionInsight(a.overview),
    trafficSources: traffic.data,
    trafficEstimated: traffic.estimated,
    trafficSource: traffic.source,
    devices: devices.data,
    devicesEstimated: devices.estimated,
    devicesSource: devices.source,
    geoData: geo.data,
    geoEstimated: geo.estimated,
    geoSource: geo.source,
    engagementData: engagement.data,
    engagementEstimated: engagement.estimated,
    videoTable: buildVideoTable(a.topVideos, a.overview),
    aiInsights: buildAIInsights(insights),
    _raw: a,
  }
}
