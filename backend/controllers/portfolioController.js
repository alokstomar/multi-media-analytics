import Channel from '../models/Channel.js'
import Video from '../models/Video.js'
import IntelligenceCache from '../models/IntelligenceCache.js'
import { getAIProvider } from '../services/ai/index.js'
import { AppError } from '../utils/errorHandler.js'

async function loadPortfolioContext(channelIds, workspaceId) {
  const channels = await Channel.find({ channelId: { $in: channelIds }, workspaceId }).lean()
  if (channels.length !== channelIds.length) {
    throw new AppError('One or more channel IDs do not belong to this workspace', 403)
  }
  const result = []
  for (const ch of channels) {
    const videos = await Video.find({ channelId: ch.channelId }).sort({ publishedAt: -1 }).limit(20).lean()
    result.push({ channel: ch, videos })
  }
  return result
}

async function cachedPortfolioAI(channelIds, feature, providerFn) {
  const cacheKey = [...channelIds].sort().join('|')
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
  if (!Array.isArray(channelIds) || channelIds.length === 0) {
    throw new AppError('channelIds must be a non-empty array', 400)
  }
  return channelIds
}

export async function getPortfolioSummary(req, res, next) {
  try {
    const channelIds = validateChannelIds(req)
    const channels = await loadPortfolioContext(channelIds, req.workspaceId)
    const result = await cachedPortfolioAI(channelIds, 'portfolio-summary', () =>
      getAIProvider().getPortfolioSummary({ channels }, { feature: 'portfolio-summary' }),
    )
    res.json(withMeta(result, 'portfolio-summary'))
  } catch (err) { next(err) }
}

export async function getAudienceOverlap(req, res, next) {
  try {
    const channelIds = validateChannelIds(req)
    const channels = await loadPortfolioContext(channelIds, req.workspaceId)
    const result = await cachedPortfolioAI(channelIds, 'portfolio-audience-overlap', () =>
      getAIProvider().getAudienceOverlap({ channels }, { feature: 'portfolio-audience-overlap' }),
    )
    res.json(withMeta(result, 'portfolio-audience-overlap'))
  } catch (err) { next(err) }
}

export async function getCrossPromotion(req, res, next) {
  try {
    const channelIds = validateChannelIds(req)
    const channels = await loadPortfolioContext(channelIds, req.workspaceId)
    const result = await cachedPortfolioAI(channelIds, 'portfolio-cross-promotion', () =>
      getAIProvider().getCrossPromotion({ channels }, { feature: 'portfolio-cross-promotion' }),
    )
    res.json(withMeta(result, 'portfolio-cross-promotion'))
  } catch (err) { next(err) }
}

export async function getPortfolioContentGaps(req, res, next) {
  try {
    const channelIds = validateChannelIds(req)
    const channels = await loadPortfolioContext(channelIds, req.workspaceId)
    const result = await cachedPortfolioAI(channelIds, 'portfolio-content-gaps', () =>
      getAIProvider().getPortfolioContentGaps({ channels }, { feature: 'portfolio-content-gaps' }),
    )
    res.json(withMeta(result, 'portfolio-content-gaps'))
  } catch (err) { next(err) }
}

export async function getCannibalization(req, res, next) {
  try {
    const channelIds = validateChannelIds(req)
    const channels = await loadPortfolioContext(channelIds, req.workspaceId)
    const result = await cachedPortfolioAI(channelIds, 'portfolio-cannibalization', () =>
      getAIProvider().getCannibalization({ channels }, { feature: 'portfolio-cannibalization' }),
    )
    res.json(withMeta(result, 'portfolio-cannibalization'))
  } catch (err) { next(err) }
}

export async function getPortfolioStrategist(req, res, next) {
  try {
    const channelIds = validateChannelIds(req)
    const channels = await loadPortfolioContext(channelIds, req.workspaceId)
    const result = await cachedPortfolioAI(channelIds, 'portfolio-strategist', () =>
      getAIProvider().getPortfolioStrategist({ channels }, { feature: 'portfolio-strategist' }),
    )
    res.json(withMeta(result, 'portfolio-strategist'))
  } catch (err) { next(err) }
}
