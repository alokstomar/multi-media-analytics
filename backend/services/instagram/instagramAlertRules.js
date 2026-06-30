/**
 * Instagram alert detection rules (v1).
 *
 * Pure configuration — no DB access. The engine reads these thresholds and
 * emits alert candidates; the service persists them with dedupe.
 *
 * Thresholds are deliberately conservative for v1. Tunable per-workspace is
 * a follow-up; for now these are app-wide constants.
 */

export const ALERT_TYPES = {
  FOLLOWER_DROP: 'FOLLOWER_DROP',
  FOLLOWER_SPIKE: 'FOLLOWER_SPIKE',
  ENGAGEMENT_DROP: 'ENGAGEMENT_DROP',
  ENGAGEMENT_SPIKE: 'ENGAGEMENT_SPIKE',
  VIRAL_REEL: 'VIRAL_REEL',
  NEGATIVE_SENTIMENT_SURGE: 'NEGATIVE_SENTIMENT_SURGE',
  POSTING_INACTIVITY: 'POSTING_INACTIVITY',
  MILESTONE_REACHED: 'MILESTONE_REACHED',
}

export const SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
}

export const RULES = {
  FOLLOWER_SPIKE: {
    threshold: 0.15, // +15%
    severity: SEVERITY.INFO,
    window: 'previous_snapshot',
    title: 'Follower Spike Detected',
    message: (ctx) =>
      `Followers increased ${(ctx.deltaPct * 100).toFixed(1)}% (${ctx.formatInt(ctx.from)} → ${ctx.formatInt(ctx.to)}).`,
  },
  FOLLOWER_DROP: {
    threshold: 0.1, // -10%
    severity: SEVERITY.CRITICAL,
    window: 'previous_snapshot',
    title: 'Follower Drop Detected',
    message: (ctx) =>
      `Followers decreased ${Math.abs(ctx.deltaPct * 100).toFixed(1)}% (${ctx.formatInt(ctx.from)} → ${ctx.formatInt(ctx.to)}).`,
  },
  ENGAGEMENT_SPIKE: {
    threshold: 0.2, // +20%
    severity: SEVERITY.INFO,
    window: 'previous_snapshot',
    title: 'Engagement Spike',
    message: (ctx) =>
      `Engagement rate increased ${(ctx.deltaPct * 100).toFixed(1)}% (${ctx.from.toFixed(2)}% → ${ctx.to.toFixed(2)}%).`,
  },
  ENGAGEMENT_DROP: {
    threshold: 0.2, // -20%
    severity: SEVERITY.WARNING,
    window: 'previous_snapshot',
    title: 'Engagement Drop',
    message: (ctx) =>
      `Engagement rate decreased ${Math.abs(ctx.deltaPct * 100).toFixed(1)}% (${ctx.from.toFixed(2)}% → ${ctx.to.toFixed(2)}%).`,
  },
  VIRAL_REEL: {
    threshold: 2.0, // > 2x account average
    severity: SEVERITY.INFO,
    window: 'recent_reels',
    title: 'Viral Reel',
    message: (ctx) =>
      `Reel "${ctx.caption}" reached ${ctx.formatInt(ctx.views)} views — ${ctx.multiplier.toFixed(1)}× account average.`,
  },
  NEGATIVE_SENTIMENT_SURGE: {
    threshold: 0.3, // > 30% negative
    severity: SEVERITY.CRITICAL,
    window: 'recent_comments',
    title: 'Negative Sentiment Surge',
    message: (ctx) =>
      `${(ctx.negativeRatio * 100).toFixed(0)}% of recent comments are negative (${ctx.negativeCount}/${ctx.totalComments}).`,
  },
  POSTING_INACTIVITY: {
    thresholdDays: 7,
    severity: SEVERITY.WARNING,
    window: 'recent_reels',
    title: 'Posting Inactivity',
    message: (ctx) =>
      `No new posts in ${ctx.daysSinceLast} day${ctx.daysSinceLast === 1 ? '' : 's'} (last post: ${ctx.lastDate}).`,
  },
  MILESTONE_REACHED: {
    milestones: [
      { level: '1K', value: 1_000 },
      { level: '10K', value: 10_000 },
      { level: '50K', value: 50_000 },
      { level: '100K', value: 100_000 },
      { level: '500K', value: 500_000 },
      { level: '1M', value: 1_000_000 },
    ],
    severity: SEVERITY.INFO,
    window: 'followers',
    title: (ctx) => `${ctx.level} Followers Milestone`,
    message: (ctx) => `Account reached ${ctx.level} followers (${ctx.formatInt(ctx.followers)} total).`,
  },
}

// UI filter buckets — types grouped by the filter chips the user sees.
export const FILTER_BUCKETS = {
  critical: (a) => a.severity === SEVERITY.CRITICAL,
  unread: (a) => !a.isRead,
  viral: (a) => a.type === ALERT_TYPES.VIRAL_REEL,
  growth: (a) =>
    a.type === ALERT_TYPES.FOLLOWER_SPIKE ||
    a.type === ALERT_TYPES.FOLLOWER_DROP ||
    a.type === ALERT_TYPES.MILESTONE_REACHED,
  engagement: (a) =>
    a.type === ALERT_TYPES.ENGAGEMENT_SPIKE ||
    a.type === ALERT_TYPES.ENGAGEMENT_DROP ||
    a.type === ALERT_TYPES.NEGATIVE_SENTIMENT_SURGE,
}
