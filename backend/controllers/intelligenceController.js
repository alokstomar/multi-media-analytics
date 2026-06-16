import Channel from '../models/Channel.js'
import Video from '../models/Video.js'
import IntelligenceCache from '../models/IntelligenceCache.js'
import { getAIProvider } from '../services/ai/index.js'
import { AppError } from '../utils/errorHandler.js'

async function loadChannelContext(channelId, workspaceId) {
  const channel = await Channel.findOne({ channelId, workspaceId })
  if (!channel) throw new AppError('Channel not found', 404)

  const videos = await Video.find({ channelId }).sort({ publishedAt: -1 }).limit(20).lean()
  return { channel, videos }
}

async function cachedAI(channelId, feature, providerFn) {
  try {
    const cached = await IntelligenceCache.findCached(channelId, feature)
    if (cached) return cached.result
  } catch { /* cache read failure — proceed to provider */ }

  const result = await providerFn()

  try {
    await IntelligenceCache.upsert(channelId, feature, result)
  } catch { /* cache write failure — non-blocking */ }

  return result
}

function contentCacheKey(content, prefix) {
  const len = content?.length || 0
  const head = (content || '').slice(0, 200).replace(/\s+/g, '')
  return `${prefix}:${len}:${head}`
}

function withMeta(result, feature) {
  return {
    ...result,
    meta: { ...result.meta, feature, requestedAt: new Date().toISOString() },
  }
}

export async function healthCheck(_req, res) {
  const provider = getAIProvider()
  const health = await provider.healthCheck()
  res.json({ success: true, data: health })
}

export async function analyzeTitle(req, res, next) {
  try {
    const provider = getAIProvider()
    const result = await provider.analyzeTitle(req.body, { feature: 'analyze-title' })
    res.json(withMeta(result, 'analyze-title'))
  } catch (err) {
    next(err)
  }
}

export async function analyzeThumbnail(req, res, next) {
  try {
    const cacheKey = contentCacheKey(req.body?.imageBase64, 'thumb')
    const result = await cachedAI(cacheKey, 'analyze-thumbnail', () =>
      getAIProvider().analyzeThumbnail(req.body, { feature: 'analyze-thumbnail' }),
    )
    res.json(withMeta(result, 'analyze-thumbnail'))
  } catch (err) {
    next(err)
  }
}

export async function analyzeScript(req, res, next) {
  try {
    const cacheKey = contentCacheKey(req.body?.script, 'script')
    const result = await cachedAI(cacheKey, 'analyze-script', () =>
      getAIProvider().analyzeScript(req.body, { feature: 'analyze-script' }),
    )
    res.json(withMeta(result, 'analyze-script'))
  } catch (err) {
    next(err)
  }
}

export async function generateVideoIdeas(req, res, next) {
  try {
    const { channelId } = req.params
    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId)
    const result = await cachedAI(channelId, 'video-ideas', () =>
      getAIProvider().generateVideoIdeas(
        { channelId, channel, videos, ...req.body },
        { channelId, feature: 'video-ideas' },
      ),
    )
    res.json(withMeta(result, 'video-ideas'))
  } catch (err) {
    next(err)
  }
}

export async function generateShortsIdeas(req, res, next) {
  try {
    const { channelId } = req.params
    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId)
    const result = await cachedAI(channelId, 'shorts-ideas', () =>
      getAIProvider().generateShortsIdeas(
        { channelId, channel, videos, ...req.body },
        { channelId, feature: 'shorts-ideas' },
      ),
    )
    res.json(withMeta(result, 'shorts-ideas'))
  } catch (err) {
    next(err)
  }
}

export async function getContentGaps(req, res, next) {
  try {
    const { channelId } = req.params
    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId)
    const result = await cachedAI(channelId, 'content-gaps', () =>
      getAIProvider().getContentGaps(
        { channelId, channel, videos, competitors: req.body?.competitors || [] },
        { channelId, feature: 'content-gaps' },
      ),
    )
    res.json(withMeta(result, 'content-gaps'))
  } catch (err) {
    next(err)
  }
}

export async function getStrategistTips(req, res, next) {
  try {
    const { channelId } = req.params
    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId)
    const result = await cachedAI(channelId, 'strategist-tips', () =>
      getAIProvider().getStrategistTips(
        { channelId, channel, videos },
        { channelId, feature: 'strategist-tips' },
      ),
    )
    res.json(withMeta(result, 'strategist-tips'))
  } catch (err) {
    next(err)
  }
}

export async function predictPerformance(req, res, next) {
  try {
    const { channelId } = req.params
    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId)
    const provider = getAIProvider()
    const result = await provider.predictPerformance(
      { channelId, channel, videos, ...req.body },
      { channelId, feature: 'predict-performance' },
    )
    res.json(withMeta(result, 'predict-performance'))
  } catch (err) {
    next(err)
  }
}
