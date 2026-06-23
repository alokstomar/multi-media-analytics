import Channel from '../models/Channel.js'
import Video from '../models/Video.js'
import IntelligenceCache from '../models/IntelligenceCache.js'
import { getAIProvider, getActiveProviderName } from '../services/ai/index.js'
import { AppError } from '../utils/errorHandler.js'

function attachAIHeaders(res) {
  res.setHeader('X-AI-Provider', getActiveProviderName())
  res.setHeader('X-AI-Status', 'success')
}

async function loadChannelContext(channelId, workspaceId) {
  const channel = await Channel.findOne({ channelId, workspaceId })
  if (!channel) throw new AppError('Channel not found', 404)

  const videos = await Video.find({ channelId }).sort({ publishedAt: -1 }).limit(20).lean()
  return { channel, videos }
}

async function cachedAI(channelId, feature, providerFn) {
  // Provider-aware cache key prevents stale stub data from poisoning
  // production responses when switching between AI_PROVIDER values.
  const provider = getActiveProviderName()
  const cacheFeature = `${provider}:${feature}`
  const startMs = Date.now()

  try {
    const cached = await IntelligenceCache.findCached(channelId, cacheFeature)
    if (cached) {
      console.log('[AI]', { provider, method: feature, channelId, cacheHit: true, durationMs: Date.now() - startMs, resultCount: countResult(cached.result) })
      return cached.result
    }
  } catch { /* cache read failure — proceed to provider */ }

  const result = await providerFn()

  const durationMs = Date.now() - startMs
  console.log('[AI]', { provider, method: feature, channelId, cacheHit: false, durationMs, resultCount: countResult(result) })

  try {
    await IntelligenceCache.upsert(channelId, cacheFeature, result)
  } catch { /* cache write failure — non-blocking */ }

  return result
}

// Count the number of items in an AI result for logging purposes.
function countResult(result) {
  if (!result || typeof result !== 'object') return 0
  if (Array.isArray(result.ideas)) return result.ideas.length
  if (Array.isArray(result.tips)) return result.tips.length
  if (Array.isArray(result.gaps)) return result.gaps.length
  if (Array.isArray(result.topRisks)) return result.topRisks.length + (result.topOpportunities?.length || 0)
  return Object.keys(result).length
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
  attachAIHeaders(res)
  res.json({ success: true, data: health })
}

export async function analyzeTitle(req, res, next) {
  try {
    const provider = getAIProvider()
    const result = await provider.analyzeTitle(req.body, { feature: 'analyze-title' })
    attachAIHeaders(res)
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
    attachAIHeaders(res)
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
    attachAIHeaders(res)
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
    attachAIHeaders(res)
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
    attachAIHeaders(res)
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
    attachAIHeaders(res)
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
    attachAIHeaders(res)
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
    attachAIHeaders(res)
    res.json(withMeta(result, 'predict-performance'))
  } catch (err) {
    next(err)
  }
}

export async function summarizeAlerts(req, res, next) {
  try {
    const { channelId } = req.params
    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId)
    const result = await cachedAI(channelId, 'alerts-summary', () =>
      getAIProvider().summarizeAlerts(
        {
          channelId,
          channel,
          videos,
          analyticsSnapshot: req.body?.analyticsSnapshot || {},
          derivedAlerts: Array.isArray(req.body?.derivedAlerts) ? req.body.derivedAlerts : [],
        },
        { channelId, feature: 'alerts-summary' },
      ),
    )
    attachAIHeaders(res)
    res.json(withMeta(result, 'alerts-summary'))
  } catch (err) {
    next(err)
  }
}
