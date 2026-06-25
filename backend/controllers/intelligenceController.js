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
  const startedAt = new Date().toISOString()
  const startMs = Date.now()

  try {
    const cached = await IntelligenceCache.findCached(channelId, cacheFeature)
    if (cached) {
      const durationMs = Date.now() - startMs
      const endedAt = new Date().toISOString()
      console.log('[AI]', { provider, method: feature, channelId, cacheHit: true, startedAt, endedAt, durationMs, resultCount: countResult(cached.result) })
      return cached.result
    }
  } catch { /* cache read failure — proceed to provider */ }

  const result = await providerFn()

  const durationMs = Date.now() - startMs
  const endedAt = new Date().toISOString()
  console.log('[AI]', { provider, method: feature, channelId, cacheHit: false, startedAt, endedAt, durationMs, resultCount: countResult(result) })
  // Cold gpt-5.4 calls legitimately take 15-25s; surface anything slower
  // for capacity / Azure-deployment investigation.
  if (durationMs > 30000) {
    console.warn('[AI SLOW]', { provider, method: feature, channelId, durationMs, threshold: 30000 })
  }

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
    success: true,
    data: {
      ...result,
      meta: { ...result?.meta, feature, requestedAt: new Date().toISOString() },
    }
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
    // 1. Structured logging of request lifecycle
    console.log('[AI Thumbnail Route] Multipart file upload received:', {
      fileReceived: !!req.file,
      fileName: req.file?.originalname || null,
      mimeType: req.file?.mimetype || null,
      size: req.file?.size || 0,
      authenticatedUser: req.user?._id?.toString() || null,
      workspaceId: req.workspaceId || null,
    })

    // 2. Guard against missing, empty, or corrupted buffers
    if (!req.file || !req.file.buffer || !req.file.buffer.length) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_BUFFER',
          message: 'Uploaded image is empty, missing, or corrupted'
        }
      })
    }

    // 3. Log AI provider and model configuration
    console.log('[AI Thumbnail Vision Analyzer] Config details:', {
      provider: process.env.AI_PROVIDER || 'openai',
      visionModel: process.env.OPENAI_PREMIUM_MODEL || 'gpt-5.4',
      userId: req.user?._id?.toString() || null
    })

    // 4. Convert req.file.buffer to base64 Data URL
    const imageBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`

    const cacheKey = contentCacheKey(imageBase64, 'thumb')
    const result = await cachedAI(cacheKey, 'analyze-thumbnail', () =>
      getAIProvider().analyzeThumbnail(
        { imageBase64, channelId: req.body?.channelId || req.query?.channelId },
        { feature: 'analyze-thumbnail' }
      )
    )

    attachAIHeaders(res)
    res.json(withMeta(result, 'analyze-thumbnail'))
  } catch (err) {
    console.error('[AI Thumbnail Route] Error analyzing thumbnail:', err)
    next(err)
  }
}

export async function analyzeScript(req, res, next) {
  try {
    const providerName = getActiveProviderName()
    let activeModel = 'unknown'
    if (providerName === 'openai') {
      activeModel = process.env.OPENAI_FAST_MODEL || 'gpt-5-mini'
    } else if (providerName === 'gemini') {
      activeModel = process.env.GEMINI_FAST_MODEL || 'gemini-2.0-flash'
    } else if (providerName === 'groq') {
      activeModel = process.env.GROQ_MODEL || 'llama-3.1-70b-versatile'
    } else if (providerName === 'stub') {
      activeModel = 'stub-model'
    }

    console.log('[AI Script Analyzer] Route handler invoked:', {
      authenticatedUser: req.user?._id?.toString() || null,
      workspaceId: req.workspaceId || null,
      scriptLength: req.body?.script?.length || 0,
      selectedChannelId: req.body?.channelId || null,
      providerName,
      activeModel
    })

    const script = req.body?.script
    if (!script || !script.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SCRIPT_REQUIRED',
          message: 'Script content is required and cannot be empty.'
        }
      })
    }

    if (script.length <= 20) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SCRIPT_TOO_SHORT',
          message: 'Script content must be longer than 20 characters to analyze pacing.'
        }
      })
    }

    const cacheKey = contentCacheKey(script, 'script')
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
