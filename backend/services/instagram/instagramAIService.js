/**
 * Instagram AI Intelligence service — orchestration layer.
 *
 * Responsibilities:
 *   - Resolve workspace-scoped IG account + assemble context (reels, comments,
 *     snapshots) the feature services need.
 *   - Read-through cache with per-feature TTLs (InstagramIntelligenceCache).
 *   - Dispatch to feature services (content strategy / competitor / growth).
 *   - Recommendations lives here because it shares the most scaffolding.
 *
 * AI provider usage:
 *   - We call getAIProvider() from services/ai/index.js — provider files are
 *     NOT modified. We adapt their YouTube-shaped payloads to IG by
 *     post-processing the response in this layer (rename "video"→"reel",
 *     "channel"→"account", etc.) and by passing IG data into the YT-shaped
 *     input slots.
 *
 * Failure model:
 *   - If the AI provider throws, every feature returns a deterministic
 *     fallback payload flagged with `_fallback: true`. The fallback is
 *     cached briefly (15min) so a transient outage doesn't hammer the
 *     provider on every request.
 */

import crypto from 'crypto'

import InstagramProfile from '../../models/InstagramProfile.js'
import InstagramAnalyticsSnapshot from '../../models/InstagramAnalyticsSnapshot.js'
import InstagramReel from '../../models/InstagramReel.js'
import InstagramComment from '../../models/InstagramComment.js'
import InstagramIntelligenceCache from '../../models/InstagramIntelligenceCache.js'
import { AppError } from '../../utils/errorHandler.js'
import { getAIProvider, getActiveProviderName } from '../ai/index.js'

import {
  getBestPostingTimes,
  getContentIdeas,
} from './instagramContentStrategyService.js'
import { getCompetitorInsights } from './instagramCompetitorService.js'
import {
  getGrowthOpportunities,
  getHashtagSuggestions,
} from './instagramGrowthService.js'

// Per-feature cache TTLs. Matches the Phase 9 spec.
export const CACHE_TTL = {
  recommendations: 24 * 60 * 60 * 1000, // 24h
  'best-times': 24 * 60 * 60 * 1000, // 24h
  'growth-opportunities': 12 * 60 * 60 * 1000, // 12h
  competitors: 24 * 60 * 60 * 1000, // 24h
  hashtags: 7 * 24 * 60 * 60 * 1000, // 7d
  'content-ideas': 12 * 60 * 60 * 1000, // 12h
}

// Fallback records are cached briefly so transient AI failures don't loop.
const FALLBACK_CACHE_TTL = 15 * 60 * 1000 // 15min

const RECENT_REELS_LIMIT = 25
const RECENT_COMMENTS_LIMIT = 200
const SLOW_CALL_THRESHOLD_MS = 30000

// =====================================================
// Account + context resolution
// =====================================================

/**
 * Resolve a workspace-scoped Instagram profile by username. The value passed
 * in is the profile's username (the frontend treats username as the account
 * id after the OAuth migration). Active records only — soft-deleted profiles
 * are treated as not found.
 */
export async function resolveAccount(username, workspaceId) {
  if (!username) throw new AppError('accountId is required', 400)
  const acc = await InstagramProfile.findOne({
    username,
    workspaceId,
    deletedAt: null,
  }).lean()
  if (!acc) {
    throw new AppError('Instagram account not found in this workspace', 404)
  }
  return acc
}

/**
 * Load the full context bundle the feature services consume:
 *   - account document
 *   - recent reels (newest-first, capped)
 *   - recent comments across those reels
 *   - latest + previous analytics snapshots (for delta math)
 */
export async function loadAccountContext(accountId, workspaceId) {
  const account = await resolveAccount(accountId, workspaceId)

  const recentReels = await InstagramReel.find({
    username: account.username,
    workspaceId,
  })
    .sort({ publishDate: -1 })
    .limit(RECENT_REELS_LIMIT)
    .lean()

  const reelIds = recentReels.map((r) => r.reelId)
  let recentComments = []
  if (reelIds.length) {
    recentComments = await InstagramComment.find({
      reelId: { $in: reelIds },
      workspaceId,
    })
      .lean()
      .limit(RECENT_COMMENTS_LIMIT)
  }

  const snapshots = await InstagramAnalyticsSnapshot.find({
    username: account.username,
    workspaceId,
  })
    .sort({ snapshotDate: -1 })
    .limit(2)
    .lean()

  return {
    account,
    recentReels,
    recentComments,
    latestSnapshot: snapshots[0] || null,
    prevSnapshot: snapshots[1] || null,
  }
}

// =====================================================
// Read-through cache
// =====================================================

function hashInput(input) {
  if (!input) return ''
  const str = typeof input === 'string' ? input : JSON.stringify(input)
  return crypto.createHash('sha1').update(str).digest('hex').substring(0, 12)
}

/**
 * Cached lookup. The computeFn returns `{ result, fallback? }`. On cache
 * hit we serve the previously-stored result. On miss we invoke computeFn,
 * log the call (with slow-call detection), and store the result with the
 * feature's TTL (or the shorter fallback TTL if computeFn flagged a
 * degraded result).
 */
export async function getCached({ workspaceId, accountId, type, input, computeFn }) {
  const ttlMs = CACHE_TTL[type] || 12 * 60 * 60 * 1000
  const inputHash = hashInput(input)
  const startedAt = new Date().toISOString()
  const startMs = Date.now()

  // 1. Read
  try {
    const cached = await InstagramIntelligenceCache.findFresh({
      workspaceId,
      accountId,
      type,
      inputHash,
    })
    if (cached) {
      const durationMs = Date.now() - startMs
      console.log('[IG AI]', {
        type,
        accountId,
        cacheHit: true,
        provider: getActiveProviderName(),
        startedAt,
        endedAt: new Date().toISOString(),
        durationMs,
      })
      return cached.result
    }
  } catch {
    /* cache read failure — proceed to compute */
  }

  // 2. Compute
  const { result, fallback = false } = await computeFn()

  const durationMs = Date.now() - startMs
  const endedAt = new Date().toISOString()
  console.log('[IG AI]', {
    type,
    accountId,
    cacheHit: false,
    fallback,
    provider: getActiveProviderName(),
    startedAt,
    endedAt,
    durationMs,
  })
  if (durationMs > SLOW_CALL_THRESHOLD_MS) {
    console.warn('[IG AI SLOW]', {
      type,
      accountId,
      durationMs,
      threshold: SLOW_CALL_THRESHOLD_MS,
    })
  }

  // 3. Write (best-effort)
  try {
    const effectiveTtl = fallback ? FALLBACK_CACHE_TTL : ttlMs
    const resultToStore = {
      ...result,
      _fallback: fallback,
      _cachedAt: new Date().toISOString(),
    }
    await InstagramIntelligenceCache.upsert({
      workspaceId,
      accountId,
      type,
      inputHash,
      result: resultToStore,
      ttlMs: effectiveTtl,
    })
  } catch {
    /* cache write failure — non-blocking */
  }

  return { ...result, _fallback: fallback }
}

// =====================================================
// Feature dispatchers (one per endpoint)
// =====================================================

export async function getRecommendations({ workspaceId, accountId }) {
  return getCached({
    workspaceId,
    accountId,
    type: 'recommendations',
    input: '',
    computeFn: async () => {
      const ctx = await loadAccountContext(accountId, workspaceId)
      return computeRecommendations(ctx)
    },
  })
}

export async function getBestTimes({ workspaceId, accountId }) {
  return getCached({
    workspaceId,
    accountId,
    type: 'best-times',
    input: '',
    computeFn: async () => {
      const ctx = await loadAccountContext(accountId, workspaceId)
      // Deterministic — never falls back.
      return { result: getBestPostingTimes(ctx) }
    },
  })
}

export async function getGrowthOpportunitiesEndpoint({ workspaceId, accountId }) {
  return getCached({
    workspaceId,
    accountId,
    type: 'growth-opportunities',
    input: '',
    computeFn: async () => {
      const ctx = await loadAccountContext(accountId, workspaceId)
      return getGrowthOpportunities(ctx)
    },
  })
}

export async function getCompetitorsEndpoint({ workspaceId, accountId }) {
  return getCached({
    workspaceId,
    accountId,
    type: 'competitors',
    input: '',
    computeFn: async () => {
      const ctx = await loadAccountContext(accountId, workspaceId)
      const allAccounts = await InstagramProfile.find({
        workspaceId,
        deletedAt: null,
      })
        .select('username followers postsCount bio')
        .lean()
      const competitors = allAccounts.filter((a) => a.username !== ctx.account.username)
      return getCompetitorInsights(ctx, competitors)
    },
  })
}

export async function getHashtagsEndpoint({ workspaceId, accountId }) {
  return getCached({
    workspaceId,
    accountId,
    type: 'hashtags',
    input: '',
    computeFn: async () => {
      const ctx = await loadAccountContext(accountId, workspaceId)
      return getHashtagSuggestions(ctx)
    },
  })
}

export async function getContentIdeasEndpoint({ workspaceId, accountId, userInput }) {
  return getCached({
    workspaceId,
    accountId,
    type: 'content-ideas',
    input: userInput || '',
    computeFn: async () => {
      const ctx = await loadAccountContext(accountId, workspaceId)
      return getContentIdeas(ctx, userInput)
    },
  })
}

// =====================================================
// Recommendations (uses existing provider.getStrategistTips)
// =====================================================

/**
 * Map our IG context into the YT-shaped payload getStrategistTips expects.
 * The provider's prompt is YouTube-flavored but the underlying signals —
 * subscriber count, posting cadence, top-performing pieces — translate
 * cleanly. We rename YT terminology back to IG in the response post-pass.
 */
function buildStrategistContext(ctx) {
  const { account, recentReels } = ctx
  const totalViews = recentReels.reduce((s, r) => s + (r.views || 0), 0)
  return {
    channelId: account.username,
    channel: {
      title: account.username,
      handle: `@${account.username}`,
      description: account.bio || '',
      subscribers: account.followers || 0,
      totalVideos: account.postsCount || 0,
      totalViews,
    },
    videos: recentReels.map((r) => ({
      title: (r.caption || '').slice(0, 100) || '(untitled reel)',
      views: r.views || 0,
      likes: r.likes || 0,
      comments: r.comments || 0,
      publishedAt: r.publishDate,
    })),
  }
}

/** One-off term sanitizer so we don't show "video" in an IG-facing UI. */
function deYouTube(text) {
  if (!text) return ''
  return String(text)
    .replace(/\bvideos?\b/gi, 'reels')
    .replace(/\bchannel\b/gi, 'account')
    .replace(/\bsubscribers?\b/gi, 'followers')
    .replace(/\bShorts?\b/g, 'Reels')
}

async function computeRecommendations(ctx) {
  const { account, recentReels } = ctx

  // Need at least a baseline of context for the AI to be useful. Below the
  // threshold we serve the deterministic fallback directly.
  if (recentReels.length < 1) {
    return { result: fallbackRecommendations(ctx), fallback: true }
  }

  try {
    const provider = getAIProvider()
    const raw = await provider.getStrategistTips(buildStrategistContext(ctx), {
      channelId: account.username,
      feature: 'ig-recommendations',
    })

    const tips = Array.isArray(raw?.tips) ? raw.tips : []
    if (!tips.length) {
      return { result: fallbackRecommendations(ctx), fallback: true }
    }

    return {
      result: {
        recommendations: tips.map((t, i) => ({
          id: t.id || i + 1,
          title: deYouTube(t.title || t.tip || ''),
          rationale: deYouTube(t.rationale || t.reason || t.description || ''),
          category: t.category || t.theme || 'General',
          impact: t.impact || t.priority || 'Medium',
          effort: t.effort || 'Medium',
        })),
        meta: {
          accountUsername: account.username,
          followers: account.followers || 0,
          generatedAt: new Date().toISOString(),
        },
      },
    }
  } catch (err) {
    console.warn('[IG AI] recommendations fell back:', err.message)
    return { result: fallbackRecommendations(ctx), fallback: true }
  }
}

function fallbackRecommendations(ctx) {
  const { account, recentReels } = ctx
  const reelsCount = recentReels.length
  const avgViews =
    reelsCount > 0
      ? Math.round(recentReels.reduce((s, r) => s + (r.views || 0), 0) / reelsCount)
      : 0

  return {
    recommendations: [
      {
        id: 1,
        title: 'Post 4–5 reels per week to keep the algorithm warm',
        rationale: 'Consistent cadence signals an active account and lifts impression allocation.',
        category: 'Posting Cadence',
        impact: 'High',
        effort: 'Low',
      },
      {
        id: 2,
        title: 'Lead every reel with a 3-second hook',
        rationale: 'The first 3 seconds drive watch-time, which the Reels ranking weighs heavily.',
        category: 'Content Strategy',
        impact: 'High',
        effort: 'Medium',
      },
      {
        id: 3,
        title: 'Use trending audio in your niche',
        rationale: 'Trending sounds amplify discovery through the Reels feed.',
        category: 'Discovery',
        impact: 'Medium',
        effort: 'Low',
      },
      {
        id: 4,
        title: 'Write caption CTAs that invite saves and shares',
        rationale: 'Saves and shares are high-signal engagement markers for the algorithm.',
        category: 'Engagement',
        impact: 'Medium',
        effort: 'Low',
      },
    ],
    meta: {
      accountUsername: account.username,
      followers: account.followers || 0,
      avgViews,
      generatedAt: new Date().toISOString(),
    },
  }
}
