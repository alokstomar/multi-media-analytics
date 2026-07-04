import Channel from '../models/Channel.js'
import Video from '../models/Video.js'
import IntelligenceCache from '../models/IntelligenceCache.js'
import { getAIProvider, getActiveProviderName } from '../services/ai/index.js'
import { AppError } from '../utils/errorHandler.js'
import crypto from 'crypto'

function attachAIHeaders(res) {
  res.setHeader('X-AI-Provider', getActiveProviderName())
  res.setHeader('X-AI-Status', 'success')
}

async function loadChannelContext(channelId, workspaceId, { req } = {}) {
  const filter = { channelId, workspaceId }
  const channel = await Channel.findOne(filter).lean()

  // Diagnostic trace — fires only on miss so the success path stays quiet.
  // Prints: auth user, auth workspace, requested channel, query, and what
  // IS in mongo for that channelId (so we can see which side is wrong).
  if (!channel) {
    const byChannelId = await Channel.findOne({ channelId }).lean()
    console.warn('[loadChannelContext] MISS', {
      authenticatedUserId: req?.user?._id ? String(req.user._id) : null,
      authenticatedUserEmail: req?.user?.email || null,
      authenticatedWorkspaceId: workspaceId ? String(workspaceId) : null,
      authenticatedWorkspaceSource: req?.headers?.['x-workspace-id']
        ? 'x-workspace-id header'
        : req?.user?.activeWorkspaceId
          ? 'user.activeWorkspaceId'
          : '(none)',
      requestedChannelId: channelId,
      query: 'Channel.findOne(' + JSON.stringify(filter) + ')',
      matchingDocument: null,
      channelExistsWithDifferentWorkspace: byChannelId
        ? {
            _id: String(byChannelId._id),
            title: byChannelId.title,
            workspaceId: String(byChannelId.workspaceId),
            workspaceIdMatches: String(byChannelId.workspaceId) === String(workspaceId),
          }
        : null,
      hint: !byChannelId
        ? 'Channel does not exist in DB at all — likely local/prod DB mismatch, or channel was deleted.'
        : String(byChannelId.workspaceId) !== String(workspaceId)
          ? `Authenticated workspace (${workspaceId}) is NOT the channel's workspace (${byChannelId.workspaceId}). The signed-in user is not a member of the workspace that owns this channel.`
          : 'workspaceId matches but query still missed — check type coercion (ObjectId vs string).',
    })
  }

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
      provider: process.env.AI_PROVIDER || 'deepseek',
      visionModel: process.env.DEEPSEEK_MODEL || 'DeepSeek-V4-Pro',
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
    if (providerName === 'deepseek') {
      activeModel = process.env.DEEPSEEK_MODEL || 'DeepSeek-V4-Pro'
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

export async function simulatePerformance(req, res, next) {
  try {
    const { title, duration, script, channelId } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TITLE_REQUIRED',
          message: 'Video title is required.'
        }
      })
    }

    if (title.length <= 10) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TITLE_TOO_SHORT',
          message: 'Video title must be longer than 10 characters.'
        }
      })
    }

    const parsedDuration = parseInt(duration)
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DURATION',
          message: 'Video duration must be greater than 0.'
        }
      })
    }

    console.log({
      operation: 'simulatePerformance',
      userId: req.user?._id?.toString() || null,
      workspaceId: req.workspaceId || null,
      titleLength: title.length,
      scriptLength: script?.length || 0,
      duration: parsedDuration,
      hasThumbnail: !!req.file
    })

    const thumbnailHash = req.file
      ? crypto.createHash('sha256').update(req.file.buffer).digest('hex')
      : 'none'

    const cacheKey = contentCacheKey(
      `${title}:${parsedDuration}:${script || ''}:${thumbnailHash}`,
      'simulate'
    )

    const thumbnailDataUrl = req.file
      ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
      : null

    const simulationPromise = cachedAI(cacheKey, 'performance-simulate', () =>
      getAIProvider().simulatePerformance({
        title,
        duration: parsedDuration,
        script,
        thumbnail: thumbnailDataUrl,
        channelId
      })
    )

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Performance simulation timed out')), 60000)
    )

    const result = await Promise.race([simulationPromise, timeoutPromise])

    attachAIHeaders(res)
    res.json(withMeta(result, 'performance-simulate'))
  } catch (err) {
    console.error('[AI Performance Simulation Route] Error simulating performance:', err)
    next(err)
  }
}

export async function generateVideoIdeas(req, res, next) {
  try {
    const { channelId } = req.params
    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId, { req })
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
    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId, { req })
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

// Resolve a single recommendation object from the video-ideas cache by id.
// The recommendation list is already persisted by generateVideoIdeas — we
// look it up here so the frontend only needs to send ideaId in the URL.
// Returns { recommendation, source } where source is 'body' | 'cache' | null.
async function resolveRecommendation(channelId, ideaId, fallback) {
  if (fallback && typeof fallback === 'object' && String(fallback.id) === String(ideaId)) {
    return { recommendation: fallback, source: 'body' }
  }
  const provider = getActiveProviderName()
  const featureKey = `${provider}:video-ideas`
  const cached = await IntelligenceCache.findCached(channelId, featureKey)
  const ideas = cached?.result?.ideas
  if (Array.isArray(ideas)) {
    const match = ideas.find((i) => String(i.id) === String(ideaId))
    if (match) return { recommendation: match, source: 'cache' }
  }
  return { recommendation: null, source: null }
}

export async function generateProductionScript(req, res, next) {
  const startedAt = Date.now()
  const requestId = `ps-${req.params.channelId}-${req.params.ideaId}-${startedAt}`
  const log = (step, payload) => {
    const elapsed = Date.now() - startedAt
    console.log(`[ProductionScript] ${requestId} [${elapsed}ms] ${step}`, payload ?? '')
  }

  try {
    // [1] Route entered — channelId + ideaId + regenerate flag from URL/query
    const { channelId, ideaId } = req.params
    const regenerate = req.query.regenerate === '1'
    log('[1] Route entered', {
      channelId,
      ideaId,
      regenerate,
      workspaceId: req.workspaceId,
      userId: req.user?.id || req.user?._id || '(none)',
    })

    // [2] User authenticated — already enforced by requireAuth middleware.
    // This log line confirms the request made it past auth + workspace guards.
    log('[2] User authenticated')

    // Validate ideaId early so we fail fast with a clear message.
    if (ideaId == null || ideaId === '' || ideaId === 'undefined' || ideaId === 'null') {
      log('FAIL — ideaId missing in URL params')
      throw new AppError('ideaId is required in the URL (/production-script/:ideaId)', 400)
    }

    // [3] Recommendation resolved — from body fallback or IntelligenceCache.
    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId, { req })
    log('[3a] Channel context loaded', {
      channelTitle: channel?.title,
      subscriberCount: channel?.subscribers,
      videoCount: videos.length,
    })

    const { recommendation, source: recSource } = await resolveRecommendation(
      channelId,
      ideaId,
      req.body?.recommendation,
    )
    if (!recommendation) {
      log('FAIL — recommendation not found', {
        channelId,
        ideaId,
        bodyRecommendationPresent: Boolean(req.body?.recommendation),
      })
      throw new AppError(
        `Recommendation ${ideaId} not found for channel ${channelId}. Regenerate video ideas first.`,
        404,
      )
    }
    log('[3b] Recommendation resolved', {
      source: recSource,
      ideaTitle: recommendation.title,
    })

    // [4] Prompt assembled — happens inside the provider, but we log that
    // we're about to invoke it and which cache path will be used.
    const provider = getAIProvider()
    const providerName = getActiveProviderName()
    const cacheFeature = `${providerName}:production-script`
    log('[4] Prompt assembly handed to provider', {
      provider: providerName,
      cacheFeature,
      mode: regenerate ? 'REGENERATE (cache bypassed)' : 'CACHED (will upsert on cold miss)',
    })

    const callProvider = () => provider.generateProductionScript(
      { channelId, channel, videos, recommendation, regenerate, regenAt: regenerate ? Date.now() : undefined },
      { channelId, feature: 'production-script' },
    )

    // Regenerate bypasses cache READ but still writes the fresh result back
    // (cachedAI upserts on every cold call). For the regenerate path we call
    // the provider directly and upsert ourselves so the cache stays fresh.
    let result
    if (regenerate) {
      result = await callProvider()
      try {
        await IntelligenceCache.upsert(channelId, cacheFeature, result)
      } catch (err) {
        log('WARN — cache write failed (non-blocking)', { error: err.message })
      }
    } else {
      result = await cachedAI(channelId, 'production-script', callProvider)
    }

    // [9] Response returned
    log('[9] Response ready', {
      durationMs: Date.now() - startedAt,
      timelineSections: Array.isArray(result?.timeline) ? result.timeline.length : 0,
      hasOverview: Boolean(result?.overview),
    })

    attachAIHeaders(res)
    res.json(withMeta(result, 'production-script'))
  } catch (err) {
    const elapsed = Date.now() - startedAt
    console.error(`[ProductionScript] ${requestId} [${elapsed}ms] FAIL`, {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      status: err?.status,
      // Surface the upstream OpenAI / Azure shape if present so a 503 from
      // the model is diagnosable without re-running with extra logging.
      aiError: err?.cause?.message || err?.error?.message || null,
    })
    next(err)
  }
}

export async function getContentGaps(req, res, next) {
  try {
    const { channelId } = req.params
    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId, { req })
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
    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId, { req })
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
    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId, { req })
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
    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId, { req })
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

export async function getCompetitorOpportunities(req, res, next) {
  try {
    const { channelId } = req.query
    if (!channelId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CHANNEL_ID_REQUIRED',
          message: 'channelId query parameter is required.'
        }
      })
    }

    // Load active channel context
    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId, { req })

    // Load competitor/portfolio channels in workspace
    const workspaceChannels = await Channel.find({ workspaceId: req.workspaceId }).lean()
    const competitors = workspaceChannels.filter(c => c.channelId !== channelId)

    // Load top competitor videos
    const competitorChannelIds = competitors.map(c => c.channelId)
    const topVideos = await Video.find({ channelId: { $in: competitorChannelIds } })
      .sort({ publishedAt: -1 })
      .limit(30)
      .lean()

    // Build unique portfolioHash and stable cacheKey
    const sortedCompIds = competitorChannelIds.sort().join(',')
    const portfolioHash = crypto.createHash('md5').update(sortedCompIds).digest('hex').substring(0, 10)
    const cacheKey = `competitor-opportunities:${req.workspaceId}:${channelId}:${portfolioHash}`

    const result = await cachedAI(cacheKey, 'competitor-opportunities', () =>
      getAIProvider().generateCompetitorOpportunities({
        channelId,
        channel,
        videos,
        competitors,
        topVideos
      }, {
        channelId,
        feature: 'competitor-opportunities'
      })
    )

    attachAIHeaders(res)
    res.json(withMeta(result, 'competitor-opportunities'))
  } catch (err) {
    console.error('[AI Competitor Opportunities Route] Error:', err)
    // Fallback data if AI fails:
    const fallbackResult = {
      opportunities: [
        {
          title: 'Unable to generate opportunities right now',
          opportunityLevel: 'Medium',
          estimatedSearchVolume: 'Unknown',
          reason: 'AI service temporarily unavailable.'
        }
      ]
    }
    attachAIHeaders(res)
    res.json(withMeta(fallbackResult, 'competitor-opportunities'))
  }
}

