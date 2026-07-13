import Channel from '../models/Channel.js'
import Video from '../models/Video.js'
import IntelligenceCache from '../models/IntelligenceCache.js'
import ScriptWorkspace from '../models/ScriptWorkspace.js'
import CreatorStyleProfile from '../models/CreatorStyleProfile.js'
import ThumbnailProfile from '../models/ThumbnailProfile.js'
import ThumbnailStrategy from '../models/ThumbnailStrategy.js'
import { getAIProvider, getActiveProviderName } from '../services/ai/index.js'
import { AppError } from '../utils/errorHandler.js'

function attachAIHeaders(res) {
  res.setHeader('X-AI-Provider', getActiveProviderName())
  res.setHeader('X-AI-Status', 'success')
}

function withMeta(result, feature) {
  return {
    success: true,
    data: {
      ...result,
      meta: { ...result?.meta, feature, requestedAt: new Date().toISOString() },
    },
  }
}

// Load channel doc + recent videos. Same helper shape as scriptWorkspaceController.
async function loadChannelContext(channelId, workspaceId) {
  const filter = { channelId, workspaceId }
  const channel = await Channel.findOne(filter).lean()
  if (!channel) {
    throw new AppError('Channel not found', 404)
  }
  const videos = await Video.find({ channelId }).sort({ publishedAt: -1 }).limit(20).lean()
  return { channel, videos }
}

// Resolve the recommendation (idea) object — from body, IntelligenceCache, or
// the ScriptWorkspace snapshot (which stores the recommendation it was built from).
async function resolveRecommendation(channelId, ideaId, workspaceId, fallback) {
  if (fallback && typeof fallback === 'object' && String(fallback.id) === String(ideaId)) {
    return fallback
  }
  const provider = getActiveProviderName()
  const featureKey = `${provider}:video-ideas`
  const cached = await IntelligenceCache.findCached(channelId, featureKey)
  const ideas = cached?.result?.ideas
  if (Array.isArray(ideas)) {
    const match = ideas.find((i) => String(i.id) === String(ideaId))
    if (match) return match
  }
  // Last resort: ScriptWorkspace stores its own recommendation snapshot.
  const sw = await ScriptWorkspace.findOne({ workspaceId, channelId, ideaId }).lean()
  if (sw?.recommendation && Object.keys(sw.recommendation).length > 0) {
    return sw.recommendation
  }
  return null
}

// Resolve the script for this idea — either from the body fallback or from
// the persisted ScriptWorkspace. Thumbnail concepts are grounded in the script.
async function resolveScript(channelId, ideaId, workspaceId, fallback) {
  if (fallback && typeof fallback === 'object' && fallback.fullScript) {
    return fallback
  }
  const sw = await ScriptWorkspace.findOne({ workspaceId, channelId, ideaId }).lean()
  return sw?.working || null
}

// ── GET /:channelId/thumbnail-workspace/:ideaId ────────────────────────────
// Bootstrap endpoint. Returns the strategy (or an empty shell), the cached
// Thumbnail DNA profile (if any), and the recommendation snapshot. Does NOT
// kick off AI generation — the frontend decides when to fire POST /generate.
export async function getThumbnailWorkspace(req, res, next) {
  try {
    const { channelId, ideaId } = req.params
    if (!ideaId || ideaId === 'undefined' || ideaId === 'null') {
      throw new AppError('ideaId is required in the URL', 400)
    }

    const { channel } = await loadChannelContext(channelId, req.workspaceId)

    // Find-or-create the strategy shell (no AI calls yet).
    const { doc: strategy, created } = await ThumbnailStrategy.findOrCreate({
      workspaceId: req.workspaceId,
      channelId,
      ideaId,
      channel,
      recommendation: req.body?.recommendation || {},
      userId: req.user?._id,
    })

    // Backfill recommendation if missing.
    if (!strategy.recommendation || Object.keys(strategy.recommendation).length === 0) {
      const rec = await resolveRecommendation(channelId, ideaId, req.workspaceId, req.body?.recommendation)
      if (rec) {
        await ThumbnailStrategy.updateOne({ _id: strategy._id }, { recommendation: rec })
        strategy.recommendation = rec
      }
    }

    // Attach DNA profile if cached.
    const thumbnailProfile = await ThumbnailProfile.findForChannel(req.workspaceId, channelId)

    attachAIHeaders(res)
    res.json({
      success: true,
      data: {
        strategy,
        thumbnailProfile: thumbnailProfile || null,
        created,
      },
      meta: { feature: 'thumbnail-workspace:get', requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
}

// ── POST /:channelId/thumbnail-workspace/:ideaId/generate ──────────────────
// Generates (or regenerates) the thumbnail strategy: 3-5 concepts + editable
// prompt + similarity breakdown. Flow:
//   1. Load channel + recent videos
//   2. Resolve recommendation + script
//   3. Get-or-build the Thumbnail DNA profile (cached separately)
//   4. Get creator style profile (cached) — grounds the concepts in voice/tone
//   5. Call generateThumbnailStrategy with all context
//   6. Persist result as working + new version
//   7. Return strategy + profile
export async function generateThumbnailStrategyController(req, res, next) {
  const startedAt = Date.now()
  const requestId = `tw-gen-${req.params.channelId}-${req.params.ideaId}-${startedAt}`
  const log = (step, payload) => {
    const elapsed = Date.now() - startedAt
    console.log(`[ThumbnailWorkspace.gen] ${requestId} [${elapsed}ms] ${step}`, payload ?? '')
  }

  try {
    const { channelId, ideaId } = req.params
    const regenerate = req.body?.regenerate === true || req.body?.regenerate === '1'

    log('[1] Route entered', { channelId, ideaId, regenerate })

    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId)

    const recommendation = await resolveRecommendation(channelId, ideaId, req.workspaceId, req.body?.recommendation)
    if (!recommendation) {
      throw new AppError(
        `Recommendation ${ideaId} not found for channel ${channelId}. Generate video ideas first.`,
        404,
      )
    }
    log('[2] Recommendation resolved', { ideaTitle: recommendation.title })

    const script = await resolveScript(channelId, ideaId, req.workspaceId, req.body?.script)
    if (!script || !script.fullScript) {
      throw new AppError(
        'Script not found for this idea. Generate or save a script in the Script Workspace first.',
        409,
      )
    }
    log('[3] Script resolved', { scriptLength: script.fullScript?.length || 0 })

    // ── Thumbnail DNA: get-or-build ────────────────────────────────────────
    let profileDoc = await ThumbnailProfile.findForChannel(req.workspaceId, channelId)
    if (!profileDoc || regenerate) {
      log('[4a] Building thumbnail DNA profile (cold)', { channelId })
      const provider = getAIProvider()
      const profile = await provider.analyzeThumbnailStyle(
        { channelId, channel, videos },
        { channelId, feature: 'analyze-thumbnail-style' },
      )
      profileDoc = await ThumbnailProfile.upsertForChannel(
        req.workspaceId,
        channelId,
        profile,
        { generatedFromVideoIds: videos.slice(0, 15).map((v) => v.videoId || v._id?.toString()) },
      )
      log('[4b] Thumbnail DNA built', { summary: profile?.summary?.slice(0, 80) })
    } else {
      log('[4] Thumbnail DNA cached')
    }

    // ── Creator style (cached) — grounds concepts in voice ─────────────────
    const creatorStyleDoc = await CreatorStyleProfile.findForChannel(req.workspaceId, channelId)

    // ── Generate the strategy ──────────────────────────────────────────────
    const provider = getAIProvider()
    log('[5] Calling generateThumbnailStrategy', { regenerate })
    const result = await provider.generateThumbnailStrategy(
      {
        channelId,
        channel,
        videos,
        ideaId,
        title: recommendation.title || script.title || '',
        script,
        creatorStyle: creatorStyleDoc?.profile || {},
        thumbnailProfile: profileDoc.profile,
        regenerate,
        regenAt: regenerate ? Date.now() : undefined,
      },
      { channelId, feature: 'generate-thumbnail-strategy' },
    )
    log('[6] Strategy generated', {
      conceptCount: result?.concepts?.length || 0,
      similarity: result?.similarity?.overall,
    })

    // ── Persist into the strategy workspace ────────────────────────────────
    const working = {
      title: recommendation.title || script.title || '',
      concepts: Array.isArray(result.concepts) ? result.concepts : [],
      prompt: result.prompt || '',
      similarity: result.similarity || {},
    }

    // findOrCreate above already guarantees a doc exists; load it to push a version.
    const strategy = await ThumbnailStrategy.findOne({ workspaceId: req.workspaceId, channelId, ideaId })
    const updated = await ThumbnailStrategy.pushVersion(strategy._id, working, {
      source: regenerate ? 'ai-regen' : 'ai-initial',
      action: regenerate ? 'regenerate' : 'generate',
      editedBy: req.user?._id,
      profileId: profileDoc._id,
    })
    const marked = await ThumbnailStrategy.markGenerated(updated._id, { profileId: profileDoc._id })

    // Update recommendation snapshot in case it changed.
    await ThumbnailStrategy.updateOne({ _id: updated._id }, { recommendation })

    attachAIHeaders(res)
    res.json({
      success: true,
      data: {
        strategy: marked,
        thumbnailProfile: profileDoc,
      },
      meta: { feature: 'thumbnail-workspace:generate', regenerate, requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    console.error(`[ThumbnailWorkspace.gen] ${requestId} FAIL`, {
      name: err?.name,
      message: err?.message,
      aiError: err?.cause?.message || err?.error?.message || null,
    })
    next(err)
  }
}

// ── POST /:channelId/thumbnail-workspace/:ideaId/save ──────────────────────
// Saves the current working state. `commit:false` (default) patches working
// without polluting the undo stack (autosave on keystroke). `commit:true`
// pushes a version (used on blur, regen, rescore).
export async function saveThumbnailStrategy(req, res, next) {
  try {
    const { channelId, ideaId } = req.params
    const { working, source = 'user-edit', action = null, commit = false } = req.body || {}

    if (!working || typeof working !== 'object') {
      throw new AppError('working object is required in the body', 400)
    }

    const strategy = await ThumbnailStrategy.findOne({ workspaceId: req.workspaceId, channelId, ideaId })
    if (!strategy) {
      throw new AppError('Thumbnail strategy not found', 404)
    }

    let updated
    if (commit) {
      updated = await ThumbnailStrategy.pushVersion(strategy._id, working, {
        source,
        action,
        editedBy: req.user?._id,
      })
    } else {
      updated = await ThumbnailStrategy.patchWorking(strategy._id, working)
    }

    attachAIHeaders(res)
    res.json({
      success: true,
      data: {
        strategy: updated,
        version: updated.versions?.length || 0,
        cursor: updated.cursor,
      },
      meta: { feature: 'thumbnail-workspace:save', requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
}

// ── POST /:channelId/thumbnail-workspace/:ideaId/undo ──────────────────────
export async function undoThumbnailStrategy(req, res, next) {
  try {
    const { channelId, ideaId } = req.params
    const strategy = await ThumbnailStrategy.findOne({ workspaceId: req.workspaceId, channelId, ideaId })
    if (!strategy) throw new AppError('Thumbnail strategy not found', 404)

    const updated = await ThumbnailStrategy.undo(strategy._id)
    attachAIHeaders(res)
    res.json({
      success: true,
      data: { strategy: updated, cursor: updated.cursor, version: updated.versions.length },
      meta: { feature: 'thumbnail-workspace:undo', requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
}

// ── POST /:channelId/thumbnail-workspace/:ideaId/redo ──────────────────────
export async function redoThumbnailStrategy(req, res, next) {
  try {
    const { channelId, ideaId } = req.params
    const strategy = await ThumbnailStrategy.findOne({ workspaceId: req.workspaceId, channelId, ideaId })
    if (!strategy) throw new AppError('Thumbnail strategy not found', 404)

    const updated = await ThumbnailStrategy.redo(strategy._id)
    attachAIHeaders(res)
    res.json({
      success: true,
      data: { strategy: updated, cursor: updated.cursor, version: updated.versions.length },
      meta: { feature: 'thumbnail-workspace:redo', requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
}

// ── POST /:channelId/thumbnail-workspace/:ideaId/similarity-score ──────────
// Re-scores the current strategy's similarity against the DNA. Used after the
// user edits the prompt, so the similarity reflects the edited prompt. Does
// NOT re-generate concepts — cheap pass.
export async function scoreThumbnailSimilarityController(req, res, next) {
  try {
    const { channelId, ideaId } = req.params
    const { strategy: explicitStrategy } = req.body || {}

    const strategy = await ThumbnailStrategy.findOne({ workspaceId: req.workspaceId, channelId, ideaId })
    if (!strategy) throw new AppError('Thumbnail strategy not found', 404)

    const working = explicitStrategy || strategy.working
    if (!working?.prompt) {
      throw new AppError('Cannot score an empty prompt', 400)
    }

    const profileDoc = await ThumbnailProfile.findForChannel(req.workspaceId, channelId)
    if (!profileDoc) {
      throw new AppError('Thumbnail DNA profile not built yet — call POST /:channelId/thumbnail-profile first', 409)
    }

    const provider = getAIProvider()
    const result = await provider.scoreThumbnailSimilarity(
      {
        channelId,
        strategy: working,
        thumbnailProfile: profileDoc.profile,
        profileId: profileDoc._id,
      },
      { channelId, feature: 'score-thumbnail-similarity' },
    )

    // Push a version with the new similarity (source = similarity-rescore).
    const updated = await ThumbnailStrategy.pushVersion(strategy._id, {
      ...strategy.working,
      similarity: result.similarity || {},
    }, {
      source: 'similarity-rescore',
      action: 'rescore',
      editedBy: req.user?._id,
      profileId: profileDoc._id,
    })

    attachAIHeaders(res)
    res.json({
      success: true,
      data: { strategy: updated, similarity: result.similarity },
      meta: { feature: 'thumbnail-workspace:similarity-score', requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
}

// ── POST /:channelId/thumbnail-profile ─────────────────────────────────────
// Explicitly builds or refreshes the Thumbnail DNA Profile for a channel.
// Pass `regenerate: true` in the body to bypass the cache.
export async function analyzeThumbnailProfileController(req, res, next) {
  try {
    const { channelId } = req.params
    const regenerate = req.body?.regenerate === true

    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId)

    let profileDoc = await ThumbnailProfile.findForChannel(req.workspaceId, channelId)
    if (profileDoc && !regenerate) {
      attachAIHeaders(res)
      return res.json({
        success: true,
        data: { thumbnailProfile: profileDoc, cached: true },
        meta: { feature: 'thumbnail-profile', requestedAt: new Date().toISOString() },
      })
    }

    const provider = getAIProvider()
    const profile = await provider.analyzeThumbnailStyle(
      { channelId, channel, videos },
      { channelId, feature: 'analyze-thumbnail-style' },
    )

    profileDoc = await ThumbnailProfile.upsertForChannel(
      req.workspaceId,
      channelId,
      profile,
      { generatedFromVideoIds: videos.slice(0, 15).map((v) => v.videoId || v._id?.toString()) },
    )

    attachAIHeaders(res)
    res.json({
      success: true,
      data: { thumbnailProfile: profileDoc, cached: false },
      meta: { feature: 'thumbnail-profile', requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
}
