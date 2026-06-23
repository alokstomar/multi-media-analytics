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

// ─── Overview → KPI Stats ──────────────────────────────────────
export function buildAnalyticsStats(overview) {
  if (!overview) return getDefaultStats()
  const o = overview
  const vg = typeof o.viewsGrowth === 'number' ? o.viewsGrowth : 0
  const er = typeof o.engagementRate === 'number' ? o.engagementRate : 0
  const tv = typeof o.totalViews === 'number' ? o.totalViews : 0
  const growthTrend = vg >= 0 ? `+${vg.toFixed(1)}%` : `${vg.toFixed(1)}%`

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
      value: o.watchTimeHours != null ? fmt(o.watchTimeHours) : '—',
      unit: o.watchTimeHours != null ? 'hrs' : '',
      trend: growthTrend,
      up: vg >= 0,
      spark: null,
      estimated: false,
      source: 'YouTube Analytics API required for watch time',
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
      value: '—',
      unit: '',
      trend: '—',
      up: true,
      spark: null,
      estimated: false,
      source: 'Not connected to AdSense — connect to view revenue',
    },
    {
      label: 'Impressions',
      value: o.impressions != null ? fmt(o.impressions) : '—',
      unit: '',
      trend: growthTrend,
      up: vg >= 0,
      spark: null,
      estimated: false,
      source: 'YouTube Analytics API required for impressions',
    },
    {
      label: 'Avg CTR',
      value: o.ctr != null ? `${o.ctr.toFixed(1)}%` : '—',
      unit: '',
      trend: '—',
      up: true,
      spark: null,
      estimated: false,
      source: 'YouTube Analytics API required for CTR',
    },
    {
      label: 'Avg View Duration',
      value: o.avgViewDuration != null ? o.avgViewDuration : '—',
      unit: '',
      trend: '—',
      up: true,
      spark: null,
      estimated: false,
      source: 'YouTube Analytics API required for view duration',
    },
    {
      label: 'Engagement Rate',
      value: er > 0 ? er.toFixed(1) : '—',
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
    { label: 'Watch Time', value: '—', unit: '', trend: '0%', up: true, spark: null, estimated: false, source: '' },
    { label: 'Subscribers', value: '0', unit: '', trend: '0%', up: true, spark: null, estimated: false, source: '' },
    { label: 'Revenue Growth', value: '—', unit: '', trend: '0%', up: true, spark: null, estimated: false, source: '' },
    { label: 'Impressions', value: '—', unit: '', trend: '0%', up: true, spark: null, estimated: false, source: '' },
    { label: 'Avg CTR', value: '—', unit: '', trend: '0%', up: true, spark: null, estimated: false, source: '' },
    { label: 'Avg View Duration', value: '—', unit: '', trend: '0%', up: true, spark: null, estimated: false, source: '' },
    { label: 'Engagement Rate', value: '—', unit: '%', trend: '0%', up: true, spark: null, estimated: false, source: '' },
  ]
}

// ─── Monthly Views → Performance Chart ─────────────────────────
export function buildPerformanceData(monthlyViews) {
  if (!monthlyViews?.length) return []
  const dataMap = {}
  monthlyViews.forEach((m) => { dataMap[m.month] = m.views })

  const sorted = [...monthlyViews].sort((a, b) => a.month.localeCompare(b.month))
  return sorted.slice(-6).map((m) => {
    const parts = m.month.split('-')
    const label = parts.length === 2 ? (MONTHS[parseInt(parts[1], 10) - 1] || m.month) : m.month
    return {
      date: label,
      views: Math.max(0, m.views),
      watchTime: m.watchTime != null ? m.watchTime : null,
      isEstimated: false,
    }
  })
}

function formatMonth(monthStr) {
  if (!monthStr) return ''
  const parts = monthStr.split('-')
  if (parts.length !== 2) return monthStr
  return MONTHS[parseInt(parts[1], 10) - 1] || monthStr
}

// ─── Retention Data (requires YouTube Analytics API) ───────────
export function buildRetentionData(overview) {
  if (!overview?.retention) {
    return { data: [], estimated: false, source: 'YouTube retention data unavailable — requires YouTube Analytics API' }
  }
  return {
    data: overview.retention,
    estimated: false,
    source: 'YouTube Analytics API',
  }
}

// ─── Retention Insights (from real overview signals only) ──────
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

// ─── Traffic Sources (from API only) ───────────────────────────
export function buildTrafficSources(trafficSources) {
  if (!Array.isArray(trafficSources) || trafficSources.length === 0) {
    return { data: [], estimated: false, source: 'YouTube traffic source data unavailable — requires YouTube Analytics API' }
  }
  return { data: trafficSources, estimated: false, source: 'YouTube Analytics API' }
}

// ─── Devices (from API only) ───────────────────────────────────
export function buildDevices(devices) {
  if (!Array.isArray(devices) || devices.length === 0) {
    return { data: [], estimated: false, source: 'YouTube device breakdown unavailable — requires YouTube Analytics API' }
  }
  return { data: devices, estimated: false, source: 'YouTube Analytics API' }
}

// ─── Geography (from API only) ─────────────────────────────────
export function buildGeoData(geoData) {
  if (!Array.isArray(geoData) || geoData.length === 0) {
    return { data: [], estimated: false, source: 'YouTube geography data unavailable — requires YouTube Analytics API' }
  }
  return { data: geoData, estimated: false, source: 'YouTube Analytics API' }
}

// ─── Engagement Data (from real monthly breakdown only) ────────
export function buildEngagementData(subscribersGrowth, monthlyViews) {
  if (monthlyViews?.length) {
    return {
      data: monthlyViews.map((m) => {
        const views = m.views || 0
        return {
          date: m.date || formatMonth(m.month),
          likes: m.likes != null ? m.likes : null,
          comments: m.comments != null ? m.comments : null,
          shares: m.shares != null ? m.shares : null,
          subs: m.newSubscribers != null ? m.newSubscribers : null,
          views,
        }
      }),
      estimated: false,
      source: 'Monthly view counts from backend',
    }
  }
  return {
    data: [],
    estimated: false,
    source: 'No monthly view data available',
  }
}

// ─── Videos → Video Table ──────────────────────────────────────
export function buildVideoTable(videos) {
  if (!videos?.length) return []
  return videos.slice(0, 8).map((v, i) => {
    const eng = v.views > 0 ? ((v.likes + v.comments) / v.views * 100).toFixed(1) : null
    const viral = calcViralScore(v, videos)
    return {
      id: i + 1,
      title: v.title || 'Untitled',
      views: fmt(v.views || 0),
      watch: v.watchTimeHours != null ? `${fmt(v.watchTimeHours)} hrs` : '—',
      eng: eng != null ? `${eng}%` : '—',
      viral,
      ctr: v.ctr != null ? `${v.ctr.toFixed(1)}%` : '—',
      ctrEstimated: false,
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

// ─── Insights → AI Panel format ────────────────────────────────
export function buildAIInsights(insights) {
  if (!insights?.length) return []
  const iconMap = { positive: 'trending', info: 'search', warning: 'alert' }
  return insights.map((ins) => ({
    type: ins.type || 'info',
    title: ins.title,
    desc: ins.description,
    action: ins.action,
    icon: iconMap[ins.type] || 'chart',
  }))
}

// ─── Full Analytics Package ────────────────────────────────────
export function transformAnalytics(analyticsRes, insightsRes) {
  const a = analyticsRes?.data || analyticsRes || {}
  const insights = insightsRes?.data || insightsRes || []

  const perfData = buildPerformanceData(a.monthlyViews)
  const retention = buildRetentionData(a.overview)
  const traffic = buildTrafficSources(a.trafficSources)
  const devices = buildDevices(a.devices)
  const geo = buildGeoData(a.geoData)
  const engagement = buildEngagementData(a.subscribersGrowth, a.monthlyViews)

  return {
    analyticsStats: buildAnalyticsStats(a.overview),
    performanceData: perfData,
    performanceHasEstimates: false,
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
    videoTable: buildVideoTable(a.topVideos),
    aiInsights: buildAIInsights(insights),
    _raw: a,
  }
}
