/**
 * Deterministic per-channel history for the Multi-Channel Performance chart.
 *
 * Real per-channel daily/weekly/monthly timeseries is not persisted today, so
 * we derive a stable curve from each channel's scale signals: total views,
 * subscribers, video count, engagement rate, and first-publish date.
 *
 * Same inputs always produce the same curve — no Math.random, no flicker.
 */
import { seededFloat } from './deterministic.js'

const DAY_MS = 24 * 60 * 60 * 1000

function channelMonthlyViews(channel) {
  const raw = channel?._raw || {}
  const total = Number(raw.totalViews || 0)
  const videos = Number(raw.totalVideos || 0)
  if (total > 0 && videos > 0) return Math.max(1, Math.round(total / Math.max(1, videos)))
  if (total > 0) return Math.max(1, Math.round(total / 50))
  const subs = Number(raw.subscribers || 0)
  return Math.max(1, Math.round(subs * 0.08))
}

function channelMonthlySubs(channel) {
  const raw = channel?._raw || {}
  const total = Number(raw.subscribers || 0)
  return Math.max(1, Math.round(total / 24))
}

function channelMonthlyEngagement(channel) {
  const raw = channel?._raw || {}
  const analytics = channel?._analytics || {}
  const er = Number(analytics.engagementRate || raw.engagementRate || 0)
  return er > 0 ? er : 4.5
}

function channelMonthlyWatchTime(channel) {
  return Math.round(channelMonthlyViews(channel) * 0.08)
}

function channelStartDate(channel) {
  const raw = channel?._raw || {}
  const candidate = raw.publishedAt || raw.createdAt || raw.firstVideoAt
  if (candidate) {
    const d = new Date(candidate)
    if (!Number.isNaN(d.getTime())) return d
  }
  // Fall back ~18 months ago so 1Y ranges always have a curve.
  return new Date(Date.now() - 540 * DAY_MS)
}

/**
 * Build a single date label for a point in time, sized to the range.
 */
function labelFor(date, range) {
  if (range === '1Y') {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  if (range === '90D') {
    return `Wk ${date.getDate()}`
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Multiplier describing how a channel's growth trend has scaled its current-month
 * baseline backwards through time. Newer channels grow faster; mature channels
 * are flatter. Seeded so the curve is stable per channel.
 */
function trendFactor(channel, pointIndex, totalPoints) {
  const ageMonths = Math.max(
    1,
    Math.round((Date.now() - channelStartDate(channel).getTime()) / (30 * DAY_MS)),
  )
  // Newer channels have steeper ramp; older channels are flatter.
  const ramp = Math.min(0.6, Math.max(0.15, 6 / ageMonths))
  // pointIndex 0 = oldest point; totalPoints-1 = current. Apply an increasing
  // discount the further back we go, with a per-channel seeded wobble.
  const progress = totalPoints > 1 ? pointIndex / (totalPoints - 1) : 1
  const seed = seededFloat(`pf-trend-${channel?.id || channel?.name || 'x'}-${pointIndex}`, 0.9, 1.1)
  const base = 0.45 + progress * (1 - 0.45) * ramp * 4
  return Math.min(1.15, Math.max(0.3, base * seed))
}

/**
 * Generate a per-channel array of { date, views, subscribers, watchTime, engagement }.
 * Each point is derived deterministically from the channel's scale signals.
 */
export function buildChannelHistory(channel, range) {
  if (!channel) return []

  const now = new Date()
  const monthlyViews = channelMonthlyViews(channel)
  const monthlySubs = channelMonthlySubs(channel)
  const monthlyEng = channelMonthlyEngagement(channel)
  const monthlyWatch = channelMonthlyWatchTime(channel)

  let pointCount, stepDays
  if (range === '7D') {
    pointCount = 7
    stepDays = 1
  } else if (range === '30D') {
    pointCount = 15
    stepDays = 2
  } else if (range === '90D') {
    pointCount = 12
    stepDays = 7
  } else {
    // 1Y — 12 monthly points
    pointCount = 12
    stepDays = 30
  }

  const dailyViewsBase = monthlyViews / 30
  const dailySubsBase = monthlySubs / 30

  return Array.from({ length: pointCount }, (_, i) => {
    const d = new Date(now.getTime() - (pointCount - 1 - i) * stepDays * DAY_MS)
    const trend = trendFactor(channel, i, pointCount)
    const wobble = seededFloat(`pf-${channel?.id || 'x'}-${range}-${i}`, 0.85, 1.15)

    let views, subscribers, watchTime
    if (range === '7D' || range === '30D') {
      views = Math.round(dailyViewsBase * stepDays * trend * wobble)
      subscribers = Math.round(dailySubsBase * stepDays * trend * wobble)
      watchTime = Math.round(views * 0.08)
    } else if (range === '90D') {
      views = Math.round(dailyViewsBase * 7 * trend * wobble)
      subscribers = Math.round(dailySubsBase * 7 * trend * wobble)
      watchTime = Math.round(views * 0.08)
    } else {
      views = Math.round(monthlyViews * trend * wobble)
      subscribers = Math.round(monthlySubs * trend * wobble)
      watchTime = Math.round(monthlyWatch * trend * wobble)
    }

    return {
      date: labelFor(d, range),
      views: Math.max(0, views),
      subscribers: Math.max(0, subscribers),
      watchTime: Math.max(0, watchTime),
      engagement: Number((monthlyEng * wobble).toFixed(2)),
      isEstimated: true,
    }
  })
}

/**
 * Merge per-channel histories into a single array of
 * { date, [channelName]: value, ... } for Recharts multi-series AreaChart.
 */
export function buildPortfolioSeries(channels, range, metric = 'views') {
  if (!Array.isArray(channels) || channels.length === 0) return []

  const perChannel = channels.map((c) => ({
    channel: c,
    history: buildChannelHistory(c, range),
  }))

  const pointCount = perChannel[0]?.history?.length || 0
  if (pointCount === 0) return []

  return Array.from({ length: pointCount }, (_, i) => {
    const point = { date: perChannel[0].history[i].date }
    for (const { channel, history } of perChannel) {
      const key = channel.name || channel.id
      point[key] = history[i]?.[metric] ?? 0
    }
    return point
  })
}

/**
 * Sum every channel's history into one aggregate curve, used for the headline
 * total readout above the chart.
 */
export function buildPortfolioTotals(channels, range) {
  if (!Array.isArray(channels) || channels.length === 0) {
    return { views: 0, subscribers: 0, watchTime: 0, engagement: 0 }
  }
  const perChannel = channels.map((c) => buildChannelHistory(c, range))
  const pointCount = perChannel[0]?.length || 0
  if (pointCount === 0) {
    return { views: 0, subscribers: 0, watchTime: 0, engagement: 0 }
  }
  const totals = { views: 0, subscribers: 0, watchTime: 0, engagement: 0 }
  for (const history of perChannel) {
    for (const p of history) {
      totals.views += p.views
      totals.subscribers += p.subscribers
      totals.watchTime += p.watchTime
    }
  }
  const lastPoints = perChannel.map((h) => h[h.length - 1]).filter(Boolean)
  totals.engagement =
    lastPoints.length > 0
      ? Number((lastPoints.reduce((s, p) => s + p.engagement, 0) / lastPoints.length).toFixed(2))
      : 0
  return totals
}
