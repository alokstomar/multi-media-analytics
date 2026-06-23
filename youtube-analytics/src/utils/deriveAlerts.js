/**
 * Derives structured alerts from real analytics data.
 *
 * Pure function — no fetching, no async, no fabrication. When analytics is
 * missing or insufficient for a rule, that rule produces no alert. Returns
 * an empty array only when no signals are present, which the Alerts page
 * renders as an honest "not enough analytics yet" empty state.
 *
 * Output shape matches what Alerts.jsx expects:
 *   { id, type, severity, title, desc, time, category, categoryColor, icon, iconBg, cta }
 */

const ALERT_CATEGORIES = {
  performance: { label: 'Performance', color: '#8B5CF6' },
  audience: { label: 'Audience', color: '#06B6D4' },
  comments: { label: 'Comments', color: '#F59E0B' },
  competitors: { label: 'Competitors', color: '#6366F1' },
}

const DEFAULT_CTAS = {
  positive: 'View Tips',
  warning: 'Review',
  info: 'Details',
}

function pct(curr, prev) {
  if (!prev || prev === 0) return null
  return ((curr - prev) / prev) * 100
}

function fmtPct(n) {
  if (n == null || !isFinite(n)) return '0%'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function lastTwoMonths(monthlyViews) {
  if (!Array.isArray(monthlyViews) || monthlyViews.length < 2) return null
  const sorted = [...monthlyViews].sort((a, b) => (a.month || '').localeCompare(b.month || ''))
  return {
    prev: sorted[sorted.length - 2],
    last: sorted[sorted.length - 1],
  }
}

/**
 * @param {object} analyticsData - from usePlatformAdapter().analyticsData (transformAnalytics output)
 * @param {object} channelMeta  - { id, name, avatar, color }
 * @returns {Array<object>} derived alerts (may be empty)
 */
export function deriveAlerts(analyticsData, channelMeta = {}) {
  if (!analyticsData) return []
  const alerts = []

  const channelId = channelMeta?.id || analyticsData?._raw?.channelId || 'channel'
  const monthlyViews = analyticsData?._raw?.monthlyViews || analyticsData?.performanceData || []
  const overview = analyticsData?._raw?.overview || {}
  const topVideos = analyticsData?._raw?.topVideos || []
  const engagementData = analyticsData?.engagementData || []

  // ── Performance: views month-over-month ────────────────────────────
  const pair = lastTwoMonths(monthlyViews)
  if (pair && typeof pair.last.views === 'number' && typeof pair.prev.views === 'number') {
    const delta = pct(pair.last.views, pair.prev.views)
    if (delta != null) {
      if (delta > 20) {
        alerts.push({
          id: `${channelId}:views-surge:${pair.last.month}`,
          type: 'performance',
          severity: 'positive',
          title: 'Views surged this month',
          desc: `Views jumped ${fmtPct(delta)} vs last month — double down on what's working and pin the top video on your channel.`,
          time: pair.last.month,
          category: ALERT_CATEGORIES.performance.label,
          categoryColor: ALERT_CATEGORIES.performance.color,
          icon: '🚀',
          iconBg: 'bg-emerald-50',
          cta: DEFAULT_CTAS.positive,
        })
      } else if (delta < -15) {
        alerts.push({
          id: `${channelId}:views-declining:${pair.last.month}`,
          type: 'performance',
          severity: 'warning',
          title: 'Views are declining',
          desc: `Views dropped ${fmtPct(delta)} vs last month. Audit thumbnail style and topic mix on the last 4 uploads.`,
          time: pair.last.month,
          category: ALERT_CATEGORIES.performance.label,
          categoryColor: ALERT_CATEGORIES.performance.color,
          icon: '📉',
          iconBg: 'bg-amber-50',
          cta: DEFAULT_CTAS.warning,
        })
      }
    }
  }

  // ── Audience: engagement rate trend ────────────────────────────────
  if (engagementData.length >= 2) {
    const last = engagementData[engagementData.length - 1]
    const prev = engagementData[engagementData.length - 2]
    const lastEng = last && typeof last.likes === 'number' && last.views > 0
      ? (last.likes + (last.comments || 0)) / last.views * 100
      : null
    const prevEng = prev && typeof prev.likes === 'number' && prev.views > 0
      ? (prev.likes + (prev.comments || 0)) / prev.views * 100
      : null
    if (lastEng != null && prevEng != null && (prevEng - lastEng) > 0.5) {
      alerts.push({
        id: `${channelId}:engagement-drop:${last.date || last.month}`,
        type: 'audience',
        severity: 'warning',
        title: 'Engagement rate is slipping',
        desc: `Engagement dropped from ${prevEng.toFixed(1)}% to ${lastEng.toFixed(1)}%. Refresh your CTA prompts and ask more direct questions in the video.`,
        time: last.date || last.month || '',
        category: ALERT_CATEGORIES.audience.label,
        categoryColor: ALERT_CATEGORIES.audience.color,
        icon: '💬',
        iconBg: 'bg-cyan-50',
        cta: DEFAULT_CTAS.warning,
      })
    }
  }

  // ── Audience: subscriber growth acceleration ──────────────────────
  if (engagementData.length >= 2) {
    const last = engagementData[engagementData.length - 1]
    const prev = engagementData[engagementData.length - 2]
    if (last?.subs != null && prev?.subs != null && prev.subs > 0) {
      const subDelta = pct(last.subs, prev.subs)
      if (subDelta != null && subDelta > 10) {
        alerts.push({
          id: `${channelId}:sub-growth-accel:${last.date || last.month}`,
          type: 'audience',
          severity: 'positive',
          title: 'Subscriber growth is accelerating',
          desc: `New subscribers up ${fmtPct(subDelta)} vs last month. Ride the wave — schedule the next upload within 7 days to compound momentum.`,
          time: last.date || last.month || '',
          category: ALERT_CATEGORIES.audience.label,
          categoryColor: ALERT_CATEGORIES.audience.color,
          icon: '⚡',
          iconBg: 'bg-cyan-50',
          cta: DEFAULT_CTAS.positive,
        })
      }
    }
  }

  // ── Comments: viral video detection ───────────────────────────────
  if (topVideos.length > 0) {
    const totalViews = topVideos.reduce((s, v) => s + (v.views || 0), 0)
    const avg = totalViews / topVideos.length
    const viral = topVideos.find((v) => v.views > avg * 2 && avg > 0)
    if (viral) {
      alerts.push({
        id: `${channelId}:viral-video:${viral._id || viral.title?.slice(0, 30)}`,
        type: 'comments',
        severity: 'positive',
        title: 'Viral video detected',
        desc: `"${(viral.title || '').slice(0, 60)}" is pulling ${Math.round((viral.views / avg) * 100)}% of your average views. Repackage it as a Short and link it from related uploads.`,
        time: 'Recent',
        category: ALERT_CATEGORIES.comments.label,
        categoryColor: ALERT_CATEGORIES.comments.color,
        icon: '🔥',
        iconBg: 'bg-amber-50',
        cta: DEFAULT_CTAS.positive,
      })
    }
  }

  // ── Competitors: sustained negative views-growth ──────────────────
  if (typeof overview.viewsGrowth === 'number' && overview.viewsGrowth < -5) {
    alerts.push({
      id: `${channelId}:momentum-loss:${new Date().toISOString().slice(0, 7)}`,
      type: 'competitors',
      severity: 'warning',
      title: 'Channel losing momentum vs niche',
      desc: `Aggregate views growth is ${fmtPct(overview.viewsGrowth)}. Competitors in your niche are likely out-shipping you — audit their recent upload cadence.`,
      time: new Date().toISOString().slice(0, 7),
      category: ALERT_CATEGORIES.competitors.label,
      categoryColor: ALERT_CATEGORIES.competitors.color,
      icon: '⚠️',
      iconBg: 'bg-indigo-50',
      cta: DEFAULT_CTAS.warning,
    })
  }

  // ── Performance: upload frequency dropped ─────────────────────────
  if (topVideos.length >= 2) {
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 86_400_000
    const sixtyDaysAgo = now - 60 * 86_400_000
    const recent = topVideos.filter((v) => new Date(v.publishedAt).getTime() >= thirtyDaysAgo).length
    const prior = topVideos.filter((v) => {
      const t = new Date(v.publishedAt).getTime()
      return t >= sixtyDaysAgo && t < thirtyDaysAgo
    }).length
    if (prior > 0 && recent < prior * 0.5) {
      alerts.push({
        id: `${channelId}:upload-frequency-drop:${new Date().toISOString().slice(0, 7)}`,
        type: 'performance',
        severity: 'warning',
        title: 'Upload frequency dropped',
        desc: `You shipped ${recent} upload(s) in the last 30 days vs ${prior} in the prior window. YouTube's algorithm rewards cadence — schedule the next video this week.`,
        time: 'Last 30 days',
        category: ALERT_CATEGORIES.performance.label,
        categoryColor: ALERT_CATEGORIES.performance.color,
        icon: '📅',
        iconBg: 'bg-violet-50',
        cta: DEFAULT_CTAS.warning,
      })
    }
  }

  return alerts
}
