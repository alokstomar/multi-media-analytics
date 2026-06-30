/**
 * Instagram alert detection engine.
 *
 * Pure functions — takes a context payload (account, prior snapshot, recent
 * reels, recent comments) and returns an array of alert candidates. The
 * service layer is responsible for dedupe + persistence.
 *
 * No DB access here, so this is trivially unit-testable in isolation.
 */

import { ALERT_TYPES, RULES, SEVERITY } from './instagramAlertRules.js'

function formatInt(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString('en-IN')
}

function dateYMD(d) {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

function pctDelta(from, to) {
  if (!from || from === 0) return 0
  return (to - from) / from
}

/**
 * Build alert candidates for a single account.
 *
 * @param {object} ctx
 * @param {object} ctx.account        InstagramAccount doc (must have followers, postsCount)
 * @param {object} [ctx.prevSnapshot] Most recent prior InstagramAnalyticsSnapshot
 * @param {Array}  [ctx.recentReels]  InstagramReel docs (newest first), up to N
 * @param {Array}  [ctx.recentComments] InstagramComment docs (last ~7 days)
 * @returns {Array<{type, severity, title, message, metadata}>}
 */
export function detectAlerts({
  account,
  prevSnapshot = null,
  recentReels = [],
  recentComments = [],
}) {
  if (!account) return []

  const out = []
  const accountId = account.accountId || String(account._id)
  const followers = account.followers || 0
  const er = account.engagementRate || prevSnapshot?.engagementRate || 0

  // ── Follower spike / drop ────────────────────────────────────────────
  if (prevSnapshot && prevSnapshot.followers > 0) {
    const delta = pctDelta(prevSnapshot.followers, followers)

    if (delta >= RULES.FOLLOWER_SPIKE.threshold) {
      out.push(
        build({
          type: ALERT_TYPES.FOLLOWER_SPIKE,
          severity: RULES.FOLLOWER_SPIKE.severity,
          title: RULES.FOLLOWER_SPIKE.title,
          message: RULES.FOLLOWER_SPIKE.message({
            deltaPct: delta,
            from: prevSnapshot.followers,
            to: followers,
            formatInt,
          }),
          metadata: {
            signature: `${accountId}:FOLLOWER_SPIKE:${dateYMD(new Date())}`,
            from: prevSnapshot.followers,
            to: followers,
            deltaPct: Number((delta * 100).toFixed(2)),
          },
        })
      )
    } else if (delta <= -RULES.FOLLOWER_DROP.threshold) {
      out.push(
        build({
          type: ALERT_TYPES.FOLLOWER_DROP,
          severity: RULES.FOLLOWER_DROP.severity,
          title: RULES.FOLLOWER_DROP.title,
          message: RULES.FOLLOWER_DROP.message({
            deltaPct: delta,
            from: prevSnapshot.followers,
            to: followers,
            formatInt,
          }),
          metadata: {
            signature: `${accountId}:FOLLOWER_DROP:${dateYMD(new Date())}`,
            from: prevSnapshot.followers,
            to: followers,
            deltaPct: Number((delta * 100).toFixed(2)),
          },
        })
      )
    }

    // ── Engagement spike / drop ───────────────────────────────────────
    if (prevSnapshot.engagementRate > 0) {
      const erDelta = pctDelta(prevSnapshot.engagementRate, er)
      if (erDelta >= RULES.ENGAGEMENT_SPIKE.threshold) {
        out.push(
          build({
            type: ALERT_TYPES.ENGAGEMENT_SPIKE,
            severity: RULES.ENGAGEMENT_SPIKE.severity,
            title: RULES.ENGAGEMENT_SPIKE.title,
            message: RULES.ENGAGEMENT_SPIKE.message({
              deltaPct: erDelta,
              from: prevSnapshot.engagementRate,
              to: er,
              formatInt,
            }),
            metadata: {
              signature: `${accountId}:ENGAGEMENT_SPIKE:${dateYMD(new Date())}`,
              from: prevSnapshot.engagementRate,
              to: er,
              deltaPct: Number((erDelta * 100).toFixed(2)),
            },
          })
        )
      } else if (erDelta <= -RULES.ENGAGEMENT_DROP.threshold) {
        out.push(
          build({
            type: ALERT_TYPES.ENGAGEMENT_DROP,
            severity: RULES.ENGAGEMENT_DROP.severity,
            title: RULES.ENGAGEMENT_DROP.title,
            message: RULES.ENGAGEMENT_DROP.message({
              deltaPct: erDelta,
              from: prevSnapshot.engagementRate,
              to: er,
              formatInt,
            }),
            metadata: {
              signature: `${accountId}:ENGAGEMENT_DROP:${dateYMD(new Date())}`,
              from: prevSnapshot.engagementRate,
              to: er,
              deltaPct: Number((erDelta * 100).toFixed(2)),
            },
          })
        )
      }
    }
  }

  // ── Viral reel / posting inactivity ──────────────────────────────────
  if (Array.isArray(recentReels) && recentReels.length > 0) {
    const avgViews = recentReels.reduce((s, r) => s + (r.views || 0), 0) / recentReels.length
    const topReel = [...recentReels].sort((a, b) => (b.views || 0) - (a.views || 0))[0]
    const multiplier = avgViews > 0 ? (topReel.views || 0) / avgViews : 0

    if (multiplier >= RULES.VIRAL_REEL.threshold && topReel.views > 0) {
      out.push(
        build({
          type: ALERT_TYPES.VIRAL_REEL,
          severity: RULES.VIRAL_REEL.severity,
          title: RULES.VIRAL_REEL.title,
          message: RULES.VIRAL_REEL.message({
            caption: truncate(topReel.caption || 'Untitled', 48),
            views: topReel.views,
            multiplier,
            formatInt,
          }),
          metadata: {
            signature: `${accountId}:VIRAL_REEL:${topReel.reelId}`,
            reelId: topReel.reelId,
            views: topReel.views,
            avgViews: Math.round(avgViews),
            multiplier: Number(multiplier.toFixed(2)),
          },
        })
      )
    }

    // Posting inactivity — look at most recent publishDate
    const lastPublish = recentReels
      .map((r) => r.publishDate)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0]
    if (lastPublish) {
      const daysSince = Math.floor((Date.now() - new Date(lastPublish).getTime()) / 86400000)
      if (daysSince >= RULES.POSTING_INACTIVITY.thresholdDays) {
        out.push(
          build({
            type: ALERT_TYPES.POSTING_INACTIVITY,
            severity: RULES.POSTING_INACTIVITY.severity,
            title: RULES.POSTING_INACTIVITY.title,
            message: RULES.POSTING_INACTIVITY.message({
              daysSinceLast: daysSince,
              lastDate: new Date(lastPublish).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              }),
            }),
            metadata: {
              signature: `${accountId}:POSTING_INACTIVITY:${dateYMD(new Date())}`,
              daysSinceLast: daysSince,
              lastPublishDate: new Date(lastPublish).toISOString(),
            },
          })
        )
      }
    } else {
      // No reels with publishDate at all — treat as inactivity
      out.push(
        build({
          type: ALERT_TYPES.POSTING_INACTIVITY,
          severity: RULES.POSTING_INACTIVITY.severity,
          title: RULES.POSTING_INACTIVITY.title,
          message: `No posts detected in the account's recent history.`,
          metadata: {
            signature: `${accountId}:POSTING_INACTIVITY:${dateYMD(new Date())}`,
            daysSinceLast: null,
          },
        })
      )
    }
  }

  // ── Negative sentiment surge ─────────────────────────────────────────
  if (Array.isArray(recentComments) && recentComments.length >= 5) {
    const total = recentComments.length
    const negative = recentComments.filter((c) => c.sentiment === 'negative').length
    const ratio = negative / total
    if (ratio >= RULES.NEGATIVE_SENTIMENT_SURGE.threshold) {
      out.push(
        build({
          type: ALERT_TYPES.NEGATIVE_SENTIMENT_SURGE,
          severity: RULES.NEGATIVE_SENTIMENT_SURGE.severity,
          title: RULES.NEGATIVE_SENTIMENT_SURGE.title,
          message: RULES.NEGATIVE_SENTIMENT_SURGE.message({
            negativeRatio: ratio,
            negativeCount: negative,
            totalComments: total,
          }),
          metadata: {
            signature: `${accountId}:NEGATIVE_SENTIMENT_SURGE:${dateYMD(new Date())}`,
            negativeCount: negative,
            totalComments: total,
            negativeRatio: Number((ratio * 100).toFixed(1)),
          },
        })
      )
    }
  }

  // ── Milestone reached ────────────────────────────────────────────────
  // Fire when followers >= milestone value AND we haven't recorded it yet.
  // The service layer dedupes via signature so each milestone fires once.
  for (const ms of RULES.MILESTONE_REACHED.milestones) {
    if (followers >= ms.value) {
      out.push(
        build({
          type: ALERT_TYPES.MILESTONE_REACHED,
          severity: RULES.MILESTONE_REACHED.severity,
          title: RULES.MILESTONE_REACHED.title({ level: ms.level }),
          message: RULES.MILESTONE_REACHED.message({ level: ms.level, followers, formatInt }),
          metadata: {
            signature: `${accountId}:MILESTONE_REACHED:${ms.level}`,
            level: ms.level,
            followers,
          },
        })
      )
      // Don't break — we want every milestone reached to be a separate alert
      // (e.g., crossing 100K should also leave the 50K alert in place).
    }
  }

  return out
}

function build({ type, severity, title, message, metadata }) {
  return { type, severity, title, message, metadata: metadata || {} }
}

function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? `${s.slice(0, n)}…` : s
}

// Exported for tests / debugging
export const __test = { pctDelta, formatInt, truncate }
