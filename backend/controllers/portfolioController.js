import Channel from '../models/Channel.js'
import Video from '../models/Video.js'
import IntelligenceCache from '../models/IntelligenceCache.js'
import { getAIProvider, getActiveProviderName } from '../services/ai/index.js'
import { AppError } from '../utils/errorHandler.js'

function attachAIHeaders(res) {
  res.setHeader('X-AI-Provider', getActiveProviderName())
  res.setHeader('X-AI-Status', 'success')
}

async function loadPortfolioContext(channelIds, workspaceId) {
  const channels = await Channel.find({ channelId: { $in: channelIds }, workspaceId }).lean()
  if (channels.length !== channelIds.length) {
    throw new AppError('One or more channel IDs do not belong to this workspace', 403)
  }
  // Single round-trip: fetch top 20 videos per channel in one sorted query, then group in-memory.
  const allVideos = await Video
    .find({ channelId: { $in: channelIds } })
    .sort({ channelId: 1, publishedAt: -1 })
    .lean()

  const byChannel = new Map()
  for (const v of allVideos) {
    const bucket = byChannel.get(v.channelId) || []
    if (bucket.length < 20) bucket.push(v)
    byChannel.set(v.channelId, bucket)
  }

  return channels.map((ch) => ({ channel: ch, videos: byChannel.get(ch.channelId) || [] }))
}

async function cachedPortfolioAI(channelIds, feature, workspaceId, providerFn) {
  const sortedIds = [...channelIds].sort().join('_')
  const provider = getActiveProviderName()
  const cacheKey = `${feature}:${workspaceId}:${sortedIds}:${provider}`
  try {
    const cached = await IntelligenceCache.findCached(cacheKey, feature)
    if (cached) return cached.result
  } catch { /* cache read failure — proceed */ }
  const result = await providerFn()
  try {
    await IntelligenceCache.upsert(cacheKey, feature, result)
  } catch { /* cache write failure — non-blocking */ }
  return result
}

function withMeta(result, feature) {
  return {
    ...result,
    meta: { ...result.meta, feature, requestedAt: new Date().toISOString() },
  }
}

function validateChannelIds(req, res, next) {
  const { channelIds } = req.body
  if (!Array.isArray(channelIds)) {
    return []
  }
  return channelIds
}

export async function getPortfolioSummary(req, res, next) {
  try {
    const channelIds = validateChannelIds(req)
    if (channelIds.length === 0) {
      attachAIHeaders(res)
      return res.json(withMeta({ channelsCount: 0, channels: [] }, 'portfolio-summary'))
    }
    const channels = await loadPortfolioContext(channelIds, req.workspaceId)
    const result = await cachedPortfolioAI(channelIds, 'portfolio-summary', req.workspaceId, () =>
      getAIProvider().getPortfolioSummary({ channels }, { feature: 'portfolio-summary' }),
    )
    attachAIHeaders(res)
    res.json(withMeta(result, 'portfolio-summary'))
  } catch (err) { next(err) }
}

export async function getAudienceOverlap(req, res, next) {
  try {
    const channelIds = validateChannelIds(req)
    if (channelIds.length === 0) {
      attachAIHeaders(res)
      return res.json(withMeta({ pairs: [], radarData: [] }, 'portfolio-audience-overlap'))
    }
    const channels = await loadPortfolioContext(channelIds, req.workspaceId)
    const result = await cachedPortfolioAI(channelIds, 'portfolio-audience-overlap', req.workspaceId, () =>
      getAIProvider().getAudienceOverlap({ channels }, { feature: 'portfolio-audience-overlap' }),
    )
    attachAIHeaders(res)
    res.json(withMeta(result, 'portfolio-audience-overlap'))
  } catch (err) { next(err) }
}

export async function getCrossPromotion(req, res, next) {
  try {
    const channelIds = validateChannelIds(req)
    if (channelIds.length === 0) {
      attachAIHeaders(res)
      return res.json(withMeta({ promotions: [] }, 'portfolio-cross-promotion'))
    }
    const channels = await loadPortfolioContext(channelIds, req.workspaceId)
    const result = await cachedPortfolioAI(channelIds, 'portfolio-cross-promotion', req.workspaceId, () =>
      getAIProvider().getCrossPromotion({ channels }, { feature: 'portfolio-cross-promotion' }),
    )
    attachAIHeaders(res)
    res.json(withMeta(result, 'portfolio-cross-promotion'))
  } catch (err) { next(err) }
}

export async function getPortfolioContentGaps(req, res, next) {
  try {
    const channelIds = validateChannelIds(req)
    if (channelIds.length === 0) {
      attachAIHeaders(res)
      return res.json(withMeta({ gaps: [] }, 'portfolio-content-gaps'))
    }
    const channels = await loadPortfolioContext(channelIds, req.workspaceId)
    const result = await cachedPortfolioAI(channelIds, 'portfolio-content-gaps', req.workspaceId, () =>
      getAIProvider().getPortfolioContentGaps({ channels }, { feature: 'portfolio-content-gaps' }),
    )
    attachAIHeaders(res)
    res.json(withMeta(result, 'portfolio-content-gaps'))
  } catch (err) { next(err) }
}

export async function getCannibalization(req, res, next) {
  try {
    const channelIds = validateChannelIds(req)
    if (channelIds.length === 0) {
      attachAIHeaders(res)
      return res.json(withMeta({ warnings: [] }, 'portfolio-cannibalization'))
    }
    const channels = await loadPortfolioContext(channelIds, req.workspaceId)
    const result = await cachedPortfolioAI(channelIds, 'portfolio-cannibalization', req.workspaceId, () =>
      getAIProvider().getCannibalization({ channels }, { feature: 'portfolio-cannibalization' }),
    )
    attachAIHeaders(res)
    res.json(withMeta(result, 'portfolio-cannibalization'))
  } catch (err) { next(err) }
}

export async function getPortfolioStrategist(req, res, next) {
  try {
    const channelIds = validateChannelIds(req)
    if (channelIds.length === 0) {
      attachAIHeaders(res)
      return res.json(withMeta({
        healthScore: 0,
        stabilityScore: 0,
        riskLevel: 'Low',
        riskBadgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-100/50',
        growthMomentum: '+0%',
        bestPerformingCh: null,
        fastestGrowingCh: null,
        highestEngagementCh: null,
        highestRevenueCh: null,
        mostConsistentCh: null,
        subConcentration: 0,
        viewConcentration: 0,
        revenueDependency: 0,
        audienceDiversification: 0,
        recommendations: [],
        actionCenter: [],
        growthRadar: []
      }, 'portfolio-strategist'))
    }
    const channels = await loadPortfolioContext(channelIds, req.workspaceId)
    const result = await cachedPortfolioAI(channelIds, 'portfolio-strategist', req.workspaceId, () =>
      getAIProvider().getPortfolioStrategist({ channels }, { feature: 'portfolio-strategist' }),
    )
    attachAIHeaders(res)
    res.json(withMeta(result, 'portfolio-strategist'))
  } catch (err) { next(err) }
}
