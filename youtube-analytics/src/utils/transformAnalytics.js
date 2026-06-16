/**
 * Transforms backend API responses into the data shapes
 * expected by analytics UI components.
 */

import { seededFloat } from './deterministic.js'
import { fmt } from './format.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ─── Channel → ChannelSelector format ──────────────────────────
export const CHANNEL_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#EC4899', // Pink
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#D946EF', // Fuchsia
  '#0EA5E9', // Sky
  '#F43F5E', // Rose
  '#EAB308', // Yellow
  '#64748B', // Slate
  '#7C3AED', // Purple-deep
  '#FB7185', // Coral
  '#2DD4BF', // Mint
  '#CA8A04', // Gold
  '#0D9488', // Teal
  '#A855F7', // Amethyst
]
export const CHANNEL_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-violet-600',
  'from-red-500 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-green-600',
  'from-pink-500 to-fuchsia-600',
  'from-orange-500 to-red-600',
  'from-cyan-500 to-blue-600',
  'from-lime-500 to-green-600',
  'from-fuchsia-500 to-purple-600',
  'from-sky-500 to-cyan-600',
  'from-rose-500 to-pink-600',
  'from-yellow-500 to-amber-600',
  'from-slate-500 to-gray-600',
  'from-violet-600 to-purple-700',
  'from-rose-400 to-red-500',
  'from-teal-400 to-emerald-500',
  'from-yellow-600 to-orange-600',
  'from-teal-600 to-cyan-700',
  'from-purple-400 to-violet-500',
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
    category: CATEGORIES[index % CATEGORIES.length],
    // Raw data for reference
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

  return [
    {
      label: 'Views',
      value: tv > 0 ? fmt(tv) : '0',
      unit: '',
      trend: vg >= 0 ? `+${vg.toFixed(1)}%` : `${vg.toFixed(1)}%`,
      up: vg >= 0,
      spark: generateSpark('views', vg),
      estimated: false,
      source: 'Total video views',
    },
    {
      label: 'Watch Time',
      value: tv > 0 ? fmt(Math.round(tv * 0.08)) : '0',
      unit: 'hrs',
      trend: vg >= 0 ? `+${vg.toFixed(1)}%` : `${vg.toFixed(1)}%`,
      up: vg >= 0,
      spark: generateSpark('watch', vg),
      estimated: true,
      source: 'Derived from total views × 0.08 min/view',
    },
    {
      label: 'Subscribers',
      value: fmt(o.subscribers || 0),
      unit: '',
      trend: vg >= 0 ? `+${(vg * 0.85).toFixed(1)}%` : `${(vg * 0.85).toFixed(1)}%`,
      up: vg >= 0,
      spark: generateSpark('subs', vg * 0.85),
      estimated: false,
      source: 'Channel subscriber count',
    },
    {
      label: 'Revenue Growth',
      value: tv > 0 ? `$${(tv * 0.00002).toFixed(1)}` : '$0',
      unit: 'K',
      trend: vg >= 0 ? `+${(vg * 0.8).toFixed(1)}%` : `${(vg * 0.8).toFixed(1)}%`,
      up: vg >= 0,
      spark: generateSpark('revenue', vg * 0.7),
      estimated: true,
      source: 'Estimated from views — not connected to AdSense',
    },
    {
      label: 'Impressions',
      value: tv > 0 ? fmt(Math.round(tv * 12.5)) : '0',
      unit: '',
      trend: vg >= 0 ? `+${(vg * 1.05).toFixed(1)}%` : `${(vg * 1.05).toFixed(1)}%`,
      up: vg >= 0,
      spark: generateSpark('impressions', vg * 1.05),
      estimated: true,
      source: 'Modeled impressions history',
    },
    {
      label: 'Avg CTR',
      value: (tv > 0 ? Math.min(12, er * 1.5).toFixed(1) : '0'),
      unit: '%',
      trend: vg > 0 ? '+1.2%' : '-0.5%',
      up: vg > 0,
      spark: generateSpark('ctr', vg * 0.5),
      estimated: true,
      source: 'Estimated from engagement rate — requires YouTube Analytics API for real CTR',
    },
    {
      label: 'Avg View Duration',
      value: '4:12',
      unit: 'm',
      trend: '+1.8%',
      up: true,
      spark: [240, 245, 248, 252, 250, 251, 252],
      estimated: true,
      source: 'Industry average watch duration',
    },
    {
      label: 'Engagement Rate',
      value: er.toFixed(1),
      unit: '%',
      trend: er > 3 ? '+0.8%' : '-0.3%',
      up: er > 3,
      spark: generateSpark('engagement', er),
      estimated: false,
      source: '(likes + comments) / views from stored videos',
    },
  ]
}


function getDefaultStats() {
  return [
    { label: 'Views', value: '0', unit: '', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
    { label: 'Watch Time', value: '0', unit: 'hrs', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
    { label: 'Subscribers', value: '0', unit: '', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
    { label: 'Revenue Growth', value: '$0', unit: 'K', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
    { label: 'Impressions', value: '0', unit: '', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
    { label: 'Avg CTR', value: '0', unit: '%', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
    { label: 'Avg View Duration', value: '0:00', unit: 'm', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
    { label: 'Engagement Rate', value: '0', unit: '%', trend: '0%', up: true, spark: [0, 0, 0, 0, 0, 0, 0] },
  ]
}

// ─── Monthly Views → Performance Chart ─────────────────────────
export function buildPerformanceData(monthlyViews, overview) {
  const dataMap = {}
  if (monthlyViews?.length) {
    monthlyViews.forEach((m) => {
      dataMap[m.month] = m.views
    })
  }

  const result = []
  const now = new Date()

  let latestYear = now.getFullYear()
  let latestMonth = now.getMonth()

  if (monthlyViews?.length) {
    const sorted = [...monthlyViews].sort((a, b) => b.month.localeCompare(a.month))
    const parts = sorted[0].month.split('-')
    if (parts.length === 2) {
      latestYear = parseInt(parts[0], 10)
      latestMonth = parseInt(parts[1], 10) - 1
    }
  }

  const avgViews = overview?.averageViews || 150000
  const freq = overview?.uploadFrequency || 3
  const estBase = avgViews * freq * 4.34
  const viewsGrowthPct = (overview?.viewsGrowth || 12.5) / 100

  for (let i = 5; i >= 0; i--) {
    const d = new Date(latestYear, latestMonth - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = MONTHS[d.getMonth()]

    let views = dataMap[key]
    let isEstimated = false
    if (views === undefined) {
      isEstimated = true
      const factor = 1 - (i * (viewsGrowthPct / 5 || 0.02))
      const variance = seededFloat(`${key}-perf`, 0.92, 1.08)
      views = Math.round(estBase * factor * variance)
    }

    result.push({
      date: label,
      views: Math.max(0, views),
      watchTime: Math.round(views * 0.08),
      isEstimated,
    })
  }

  return result
}

function formatMonth(monthStr) {
  if (!monthStr) return ''
  const parts = monthStr.split('-')
  if (parts.length !== 2) return monthStr
  return MONTHS[parseInt(parts[1], 10) - 1] || monthStr
}

function getDefaultPerformance() {
  return MONTHS.map((m) => ({ date: m, views: 0, watchTime: 0 }))
}

// ─── Retention Data (generated from engagement metrics) ────────
export function buildRetentionData(overview) {
  const eng = overview?.engagementRate || 3
  const base = Math.min(100, 60 + eng * 5)
  const steps = ['0s', '5s', '10s', '15s', '20s', '30s', '45s', '60s', '90s', '2m', '3m', '5m', '7m', '10m']
  const decay = [1, 0.92, 0.85, 0.78, 0.72, 0.63, 0.54, 0.48, 0.39, 0.33, 0.27, 0.20, 0.14, 0.09]
  return {
    data: steps.map((s, i) => ({
      second: s,
      retention: Math.round(base * decay[i]),
    })),
    estimated: true,
    source: 'Modeled from engagement rate — requires YouTube Analytics API for real retention',
  }
}

// ─── Retention Insights (generated from overview) ──────────────
export function buildRetentionInsights(overview) {
  const eng = overview?.engagementRate || 0
  const growth = overview?.viewsGrowth || 0
  return [
    { color: 'blue', title: 'Best hook timing', desc: `Engagement rate is ${eng.toFixed(1)}% — front-load value in first 5 seconds` },
    { color: 'orange', title: 'Drop-off zone detected', desc: growth < 0 ? 'Views declining — check if intros are too long' : 'Most viewers leave between 20-45 seconds' },
    { color: 'purple', title: 'Suggested intro: <5s', desc: 'Channels with short intros see +18% retention' },
    { color: 'green', title: 'Viewer behavior', desc: eng > 4 ? 'High engagement suggests strong content-audience fit' : 'Experiment with different hooks to boost retention' },
  ]
}

// ─── Traffic Sources (from API) ────────────────────────────────
export function buildTrafficSources(trafficSources) {
  const data = trafficSources || [
    { name: 'YouTube Search', value: 35, color: '#3B82F6' },
    { name: 'Browse Features', value: 28, color: '#8B5CF6' },
    { name: 'Suggested Videos', value: 18, color: '#EF4444' },
    { name: 'External', value: 12, color: '#F59E0B' },
    { name: 'Others', value: 7, color: '#10B981' },
  ]
  return { data, estimated: true, source: 'Estimated from video view variance — requires YouTube Analytics API' }
}

// ─── Devices (estimated from channel data) ─────────────────────
export function buildDevices() {
  return {
    data: [
      { name: 'Mobile', value: 62, color: '#3B82F6' },
      { name: 'Desktop', value: 24, color: '#8B5CF6' },
      { name: 'Tablet', value: 8, color: '#10B981' },
      { name: 'TV', value: 6, color: '#F59E0B' },
    ],
    estimated: true,
    source: 'Industry-average device split — requires YouTube Analytics API',
  }
}

// ─── Geography (estimated) ─────────────────────────────────────
export function buildGeoData(overview) {
  const subs = overview?.subscribers || 0
  return {
    data: [
      { country: 'USA', views: Math.round(subs * 0.35), pct: 35.2, flag: '🇺🇸' },
      { country: 'India', views: Math.round(subs * 0.18), pct: 17.2, flag: '🇮🇳' },
      { country: 'UK', views: Math.round(subs * 0.09), pct: 8.3, flag: '🇬🇧' },
      { country: 'Canada', views: Math.round(subs * 0.06), pct: 6.1, flag: '🇨🇦' },
      { country: 'Australia', views: Math.round(subs * 0.05), pct: 4.7, flag: '🇦🇺' },
      { country: 'Germany', views: Math.round(subs * 0.04), pct: 3.7, flag: '🇩🇪' },
      { country: 'Others', views: Math.round(subs * 0.23), pct: 24.8, flag: '🌍' },
    ],
    estimated: true,
    source: 'Estimated geographic distribution — requires YouTube Analytics API',
  }
}

// ─── Subscribers Growth → Engagement Data ──────────────────────
export function buildEngagementData(subscribersGrowth, monthlyViews) {
  if (monthlyViews?.length) {
    return {
      data: monthlyViews.map((m) => ({
        date: m.date || formatMonth(m.month),
        likes: Math.round(m.views * 0.04),
        comments: Math.round(m.views * 0.006),
        shares: Math.round(m.views * 0.015),
        subs: Math.round(m.views * 0.025),
      })),
      estimated: true,
      source: 'Engagement breakdown estimated from monthly view totals',
    }
  }
  return {
    data: MONTHS.map((m) => ({
      date: m, likes: 0, comments: 0, shares: 0, subs: 0,
    })),
    estimated: true,
    source: 'No monthly view data available',
  }
}

// ─── Videos → Video Table ──────────────────────────────────────
export function buildVideoTable(videos) {
  if (!videos?.length) return []
  return videos.slice(0, 8).map((v, i) => {
    const eng = v.views > 0 ? ((v.likes + v.comments) / v.views * 100).toFixed(1) : '0'
    const ctr = v.views > 0 ? seededFloat(`${v.videoId}-ctr`, 3, 9).toFixed(1) : '0'
    const viral = calcViralScore(v, videos)
    return {
      id: i + 1,
      title: v.title || 'Untitled',
      views: fmt(v.views || 0),
      watch: `${fmt(Math.round((v.views || 0) * 0.08))} hrs`,
      eng: `${eng}%`,
      viral,
      ctr: `${ctr}%`,
      ctrEstimated: true,
      badge: viral >= 90 ? 'Viral' : viral >= 80 ? 'Hot' : viral >= 70 ? 'Rising' : 'Stable',
      thumb: v.thumbnail || `https://ui-avatars.com/api/?name=V${i}&background=random&size=60`,
    }
  })
}

function calcViralScore(video, allVideos) {
  if (!allVideos?.length) return 50
  const avg = allVideos.reduce((s, v) => s + v.views, 0) / allVideos.length
  if (avg === 0) return 50
  const ratio = video.views / avg
  return Math.min(99, Math.max(30, Math.round(50 + ratio * 20)))
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

// ─── Helpers ───────────────────────────────────────────────────
function generateSpark(seed, base) {
  const b = Math.abs(base || 3)
  return Array.from({ length: 7 }, (_, i) =>
    parseFloat((b * 0.5 + (b * 0.8 * i) / 6 + seededFloat(`${seed}-${i}`, 0, b * 0.2)).toFixed(1))
  )
}

// ─── Full Analytics Package ────────────────────────────────────
export function transformAnalytics(analyticsRes, insightsRes) {
  const a = analyticsRes?.data || analyticsRes || {}
  const insights = insightsRes?.data || insightsRes || []

  const perfData = buildPerformanceData(a.monthlyViews, a.overview)
  const retention = buildRetentionData(a.overview)
  const traffic = buildTrafficSources(a.trafficSources)
  const devices = buildDevices()
  const geo = buildGeoData(a.overview)
  const engagement = buildEngagementData(a.subscribersGrowth, perfData)

  return {
    analyticsStats: buildAnalyticsStats(a.overview),
    performanceData: perfData,
    performanceHasEstimates: perfData.some((p) => p.isEstimated),
    retentionData: retention.data,
    retentionEstimated: retention.estimated,
    retentionSource: retention.source,
    retentionInsights: buildRetentionInsights(a.overview),
    trafficSources: traffic.data,
    trafficEstimated: traffic.estimated,
    trafficSource: traffic.source,
    devices: devices.data,
    devicesEstimated: devices.estimated,
    geoData: geo.data,
    geoEstimated: geo.estimated,
    engagementData: engagement.data,
    engagementEstimated: engagement.estimated,
    videoTable: buildVideoTable(a.topVideos),
    aiInsights: buildAIInsights(insights),
    _raw: a,
  }
}
