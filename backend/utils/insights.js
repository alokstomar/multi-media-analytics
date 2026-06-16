/**
 * AI Insights Generator
 * Analyzes channel + video data and produces actionable insight cards.
 */

import { engagementRate, viewsGrowth, uploadFrequency, averageViews } from './analytics.js'

export function generateInsights(channel, videos) {
  if (!videos.length) return []

  const insights = []
  const growth = viewsGrowth(videos)
  const eng = engagementRate(videos)
  const freq = uploadFrequency(videos)
  const avg = averageViews(videos)

  // ── 1. Views Growth ──────────────────────────────────────
  if (growth > 5) {
    insights.push({
      type: 'positive',
      color: 'green',
      title: `Views increased ${growth}% recently`,
      description: 'Momentum is building — keep up the upload schedule',
      action: 'View Details',
    })
  } else if (growth < -5) {
    insights.push({
      type: 'warning',
      color: 'orange',
      title: `Views dropped ${Math.abs(growth)}% recently`,
      description: 'Consider experimenting with new content formats',
      action: 'Optimize Now',
    })
  }

  // ── 2. Best Posting Time ─────────────────────────────────
  const hourCounts = {}
  videos.forEach((v) => {
    const h = new Date(v.publishedAt).getHours()
    hourCounts[h] = (hourCounts[h] || 0) + v.views
  })
  const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
  if (bestHour) {
    const h = Number(bestHour[0])
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    insights.push({
      type: 'info',
      color: 'blue',
      title: 'Best posting time',
      description: `${h12} – ${h12 + 3 > 12 ? (h12 + 3) % 12 : h12 + 3} ${period} IST`,
      action: 'Schedule Post',
    })
  }

  // ── 3. Engagement Insight ────────────────────────────────
  if (eng < 2) {
    insights.push({
      type: 'warning',
      color: 'orange',
      title: 'Low engagement detected',
      description: `Your engagement rate is ${eng}% — try shorter intros and stronger hooks`,
      action: 'Optimize Now',
    })
  } else if (eng > 5) {
    insights.push({
      type: 'positive',
      color: 'green',
      title: `Strong engagement at ${eng}%`,
      description: 'Your audience is highly active — double down on this content style',
      action: 'View Details',
    })
  }

  // ── 4. Upload Frequency ──────────────────────────────────
  if (freq < 1) {
    insights.push({
      type: 'warning',
      color: 'orange',
      title: 'Upload frequency is low',
      description: `${freq.toFixed(1)} videos/week — aim for at least 1 per week`,
      action: 'Set Reminder',
    })
  } else if (freq >= 2) {
    insights.push({
      type: 'positive',
      color: 'green',
      title: 'Great upload consistency',
      description: `${freq.toFixed(1)} videos/week — your schedule is on track`,
      action: 'View Details',
    })
  }

  // ── 5. Top Video Outperformance ──────────────────────────
  const topVideo = [...videos].sort((a, b) => b.views - a.views)[0]
  if (topVideo && avg > 0 && topVideo.views > avg * 2) {
    const multiplier = (topVideo.views / avg).toFixed(1)
    insights.push({
      type: 'info',
      color: 'blue',
      title: `"${topVideo.title.slice(0, 35)}..." went viral`,
      description: `${multiplier}x your average views — analyze what worked`,
      action: 'Analyze Video',
    })
  }

  // ── 6. Retention Warning ─────────────────────────────────
  const lowEngagementVideos = videos.filter(
    (v) => v.views > 0 && (v.likes + v.comments) / v.views < 0.01,
  )
  if (lowEngagementVideos.length > videos.length * 0.3) {
    insights.push({
      type: 'warning',
      color: 'orange',
      title: 'Retention drops after initial views',
      description: `${lowEngagementVideos.length} videos have low engagement-to-view ratios`,
      action: 'Optimize Now',
    })
  }

  return insights
}
