import Channel from '../models/Channel.js'
import Video from '../models/Video.js'
import IntelligenceCache from '../models/IntelligenceCache.js'
import ScriptWorkspace from '../models/ScriptWorkspace.js'
import CreatorStyleProfile from '../models/CreatorStyleProfile.js'
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

// Load channel doc + recent videos. Mirrors the helper in intelligenceController
// but inlined here so this controller stays self-contained.
async function loadChannelContext(channelId, workspaceId, { req } = {}) {
  const filter = { channelId, workspaceId }
  const channel = await Channel.findOne(filter).lean()
  if (!channel) {
    throw new AppError('Channel not found', 404)
  }
  const videos = await Video.find({ channelId }).sort({ publishedAt: -1 }).limit(20).lean()
  return { channel, videos }
}

// Resolve the recommendation (idea) object — either from the request body,
// or from the IntelligenceCache where generateVideoIdeas stored it.
async function resolveRecommendation(channelId, ideaId, fallback) {
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
  return null
}

// ── GET /:channelId/script-workspace/:ideaId ────────────────────────────────
// Bootstrap endpoint. Returns the workspace (or an empty shell), the cached
// creator style profile (if any), and the recommendation (idea) snapshot.
// Does NOT kick off any AI generation — the frontend decides when to fire
// POST /generate based on whether working.fullScript is empty.
export async function getScriptWorkspace(req, res, next) {
  try {
    const { channelId, ideaId } = req.params
    if (!ideaId || ideaId === 'undefined' || ideaId === 'null') {
      throw new AppError('ideaId is required in the URL', 400)
    }

    const { channel } = await loadChannelContext(channelId, req.workspaceId, { req })

    // Find-or-create the workspace shell (no AI calls yet).
    let workspace = await ScriptWorkspace.findOne({ workspaceId: req.workspaceId, channelId, ideaId }).lean()
    let created = false
    if (!workspace) {
      workspace = await ScriptWorkspace.create({
        workspaceId: req.workspaceId,
        channelId,
        ideaId,
        channel: {
          title: channel.title || '',
          handle: channel.handle || '',
          profileImage: channel.profileImage || '',
        },
        recommendation: {},
        working: { title: '', hook: '', fullScript: '', cta: '', description: '', hashtags: [] },
        versions: [],
        cursor: 0,
      })
      workspace = workspace.toObject()
      created = true
    }

    // Always try to backfill recommendation if missing.
    if (!workspace.recommendation || Object.keys(workspace.recommendation).length === 0) {
      const rec = await resolveRecommendation(channelId, ideaId, req.body?.recommendation)
      if (rec) {
        await ScriptWorkspace.updateOne({ _id: workspace._id }, { recommendation: rec })
        workspace.recommendation = rec
      }
    }

    // Attach creator style profile if cached (don't compute on GET — too slow).
    const creatorStyle = await CreatorStyleProfile.findForChannel(req.workspaceId, channelId)

    attachAIHeaders(res)
    res.json({
      success: true,
      data: {
        workspace,
        creatorStyle: creatorStyle || null,
        created,
      },
      meta: { feature: 'script-workspace:get', requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
}

// ── POST /:channelId/script-workspace/:ideaId/generate ──────────────────────
// Generates (or regenerates) the script for this workspace. The flow:
//   1. Load channel + recent videos
//   2. Resolve the recommendation (from body fallback or video-ideas cache)
//   3. Get-or-build the Creator Style Profile (cached separately)
//   4. Call generateStyledScript with mode + creatorStyle
//   5. Persist result as the workspace's working state + new version
//   6. Return the workspace + styleMatch + creatorStyle
export async function generateStyledScriptController(req, res, next) {
  const startedAt = Date.now()
  const requestId = `sw-gen-${req.params.channelId}-${req.params.ideaId}-${startedAt}`
  const log = (step, payload) => {
    const elapsed = Date.now() - startedAt
    console.log(`[ScriptWorkspace.gen] ${requestId} [${elapsed}ms] ${step}`, payload ?? '')
  }

  try {
    const { channelId, ideaId } = req.params
    const mode = ['similar', 'creative', 'new'].includes(req.body?.mode) ? req.body.mode : 'similar'
    const regenerate = req.body?.regenerate === true || req.body?.regenerate === '1'

    log('[1] Route entered', { channelId, ideaId, mode, regenerate })

    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId, { req })

    const recommendation = await resolveRecommendation(channelId, ideaId, req.body?.recommendation)
    if (!recommendation) {
      throw new AppError(
        `Recommendation ${ideaId} not found for channel ${channelId}. Regenerate video ideas first.`,
        404,
      )
    }
    log('[2] Recommendation resolved', { ideaTitle: recommendation.title })

    // ── Creator style: get-or-build ────────────────────────────────────────
    let creatorStyleDoc = await CreatorStyleProfile.findForChannel(req.workspaceId, channelId)
    const staleProfile = !creatorStyleDoc
      || (creatorStyleDoc.profileVersion || 1) !== CreatorStyleProfile.CURRENT_PROFILE_VERSION
    if (staleProfile || regenerate) {
      log('[3a] Building creator style profile (cold)', {
        channelId,
        reason: !creatorStyleDoc ? 'missing' : regenerate ? 'regenerate' : 'version-mismatch',
        storedVersion: creatorStyleDoc?.profileVersion ?? 0,
        currentVersion: CreatorStyleProfile.CURRENT_PROFILE_VERSION,
      })
      const provider = getAIProvider()
      const profile = await provider.analyzeCreatorStyle(
        { channelId, channel, videos },
        { channelId, feature: 'analyze-creator-style' },
      )
      creatorStyleDoc = await CreatorStyleProfile.upsertForChannel(
        req.workspaceId,
        channelId,
        profile,
        {
          generatedFromVideoIds: videos.slice(0, 15).map((v) => v.videoId || v._id?.toString()),
          profileVersion: CreatorStyleProfile.CURRENT_PROFILE_VERSION,
        },
      )
      log('[3b] Creator style profile built', { profileKeys: Object.keys(profile || {}) })
    } else {
      log('[3] Creator style profile cached')
    }

    // ── Generate the script ────────────────────────────────────────────────
    const provider = getAIProvider()
    log('[4] Calling generateStyledScript', { mode })
    const script = await provider.generateStyledScript(
      {
        channelId,
        channel,
        videos,
        recommendation,
        creatorStyle: creatorStyleDoc.profile,
        mode,
        regenerate,
        regenAt: regenerate ? Date.now() : undefined,
      },
      { channelId, feature: 'generate-styled-script' },
    )
    log('[5] Script generated', { hasFullScript: Boolean(script?.fullScript), styleMatch: script?.styleMatch?.overall })

    // ── Persist into the workspace ─────────────────────────────────────────
    const working = {
      title: script.title || recommendation.title || '',
      hook: script.hook || '',
      fullScript: script.fullScript || '',
      cta: script.cta || '',
      description: script.description || '',
      hashtags: Array.isArray(script.hashtags) ? script.hashtags : [],
    }

    let workspace = await ScriptWorkspace.findOne({ workspaceId: req.workspaceId, channelId, ideaId })
    if (!workspace) {
      workspace = await ScriptWorkspace.create({
        workspaceId: req.workspaceId,
        channelId,
        ideaId,
        channel: {
          title: channel.title || '',
          handle: channel.handle || '',
          profileImage: channel.profileImage || '',
        },
        recommendation,
        working,
        versions: [],
        cursor: 0,
        aiGeneratedAt: new Date(),
        styleMatch: script.styleMatch || {},
      })
      workspace = workspace.toObject()
      // Seed the initial version.
      workspace = await ScriptWorkspace.pushVersion(workspace._id, working, {
        source: 'ai-initial',
        action: mode,
        editedBy: req.user?._id,
        styleMatch: script.styleMatch,
      })
    } else {
      workspace = await ScriptWorkspace.pushVersion(workspace._id, working, {
        source: regenerate ? 'ai-regen' : 'ai-initial',
        action: `mode:${mode}`,
        editedBy: req.user?._id,
        styleMatch: script.styleMatch,
      })
      workspace = await ScriptWorkspace.markGenerated(workspace._id, { styleMatch: script.styleMatch })
      // Update recommendation snapshot in case it changed.
      await ScriptWorkspace.updateOne({ _id: workspace._id }, { recommendation })
    }

    attachAIHeaders(res)
    res.json({
      success: true,
      data: {
        workspace,
        creatorStyle: creatorStyleDoc,
        styleMatch: script.styleMatch,
      },
      meta: { feature: 'script-workspace:generate', mode, requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    console.error(`[ScriptWorkspace.gen] ${requestId} FAIL`, {
      name: err?.name,
      message: err?.message,
      aiError: err?.cause?.message || err?.error?.message || null,
    })
    next(err)
  }
}

// ── POST /:channelId/script-workspace/:ideaId/save ──────────────────────────
// Saves the current working state. By default this patches working without
// polluting the undo stack (good for keystroke-by-keystroke autosave). Pass
// `commit: true` to push a version (used on blur, transform, regen).
export async function saveScriptWorkspace(req, res, next) {
  try {
    const { channelId, ideaId } = req.params
    const { working, source = 'user-edit', action = null, commit = false, styleMatch = null } = req.body || {}

    if (!working || typeof working !== 'object') {
      throw new AppError('working object is required in the body', 400)
    }

    const workspace = await ScriptWorkspace.findOne({ workspaceId: req.workspaceId, channelId, ideaId })
    if (!workspace) {
      throw new AppError('Workspace not found', 404)
    }

    let updated
    if (commit) {
      updated = await ScriptWorkspace.pushVersion(workspace._id, working, {
        source,
        action,
        editedBy: req.user?._id,
        styleMatch,
      })
    } else {
      updated = await ScriptWorkspace.patchWorking(workspace._id, working, { styleMatch })
    }

    attachAIHeaders(res)
    res.json({
      success: true,
      data: {
        workspace: updated,
        version: updated.versions?.length || 0,
        cursor: updated.cursor,
      },
      meta: { feature: 'script-workspace:save', requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
}

// ── POST /:channelId/script-workspace/:ideaId/undo ──────────────────────────
export async function undoScriptWorkspace(req, res, next) {
  try {
    const { channelId, ideaId } = req.params
    const workspace = await ScriptWorkspace.findOne({ workspaceId: req.workspaceId, channelId, ideaId })
    if (!workspace) throw new AppError('Workspace not found', 404)

    const updated = await ScriptWorkspace.undo(workspace._id)
    attachAIHeaders(res)
    res.json({
      success: true,
      data: { workspace: updated, cursor: updated.cursor, version: updated.versions.length },
      meta: { feature: 'script-workspace:undo', requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
}

// ── POST /:channelId/script-workspace/:ideaId/redo ──────────────────────────
export async function redoScriptWorkspace(req, res, next) {
  try {
    const { channelId, ideaId } = req.params
    const workspace = await ScriptWorkspace.findOne({ workspaceId: req.workspaceId, channelId, ideaId })
    if (!workspace) throw new AppError('Workspace not found', 404)

    const updated = await ScriptWorkspace.redo(workspace._id)
    attachAIHeaders(res)
    res.json({
      success: true,
      data: { workspace: updated, cursor: updated.cursor, version: updated.versions.length },
      meta: { feature: 'script-workspace:redo', requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
}

// ── POST /:channelId/script-workspace/:ideaId/transform ─────────────────────
// Applies a transformation (shorter, longer, viral, etc.) to the current
// working script via the rewriteScript provider method. The result is
// pushed as a new version with source='ai-transform'.
export async function transformScript(req, res, next) {
  try {
    const { channelId, ideaId } = req.params
    const { action, script: explicitScript } = req.body || {}

    const validActions = ['rewrite', 'shorter', 'longer', 'viral', 'emotional', 'educational', 'storytelling']
    if (!validActions.includes(action)) {
      throw new AppError(`action must be one of: ${validActions.join(', ')}`, 400)
    }

    const workspace = await ScriptWorkspace.findOne({ workspaceId: req.workspaceId, channelId, ideaId })
    if (!workspace) throw new AppError('Workspace not found', 404)

    const scriptInput = explicitScript || workspace.working
    if (!scriptInput?.fullScript) {
      throw new AppError('Cannot transform an empty script', 400)
    }

    const creatorStyleDoc = await CreatorStyleProfile.findForChannel(req.workspaceId, channelId)

    const provider = getAIProvider()
    const result = await provider.rewriteScript(
      {
        channelId,
        script: scriptInput,
        action,
        creatorStyle: creatorStyleDoc?.profile || {},
      },
      { channelId, feature: 'rewrite-script' },
    )

    const working = {
      title: result.title || scriptInput.title,
      hook: result.hook || scriptInput.hook,
      fullScript: result.fullScript || scriptInput.fullScript,
      cta: result.cta || scriptInput.cta,
      description: result.description || scriptInput.description,
      hashtags: Array.isArray(result.hashtags) ? result.hashtags : scriptInput.hashtags,
    }

    const updated = await ScriptWorkspace.pushVersion(workspace._id, working, {
      source: 'ai-transform',
      action,
      editedBy: req.user?._id,
    })

    attachAIHeaders(res)
    res.json({
      success: true,
      data: { workspace: updated, script: result },
      meta: { feature: 'script-workspace:transform', action, requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
}

// ── POST /:channelId/script-workspace/:ideaId/style-score ───────────────────
// Re-scores the current script against the creator style profile. Used by
// the editor to refresh the Style Match panel after manual edits.
export async function scoreScriptStyleController(req, res, next) {
  try {
    const { channelId, ideaId } = req.params
    const { script: explicitScript } = req.body || {}

    const workspace = await ScriptWorkspace.findOne({ workspaceId: req.workspaceId, channelId, ideaId })
    if (!workspace) throw new AppError('Workspace not found', 404)

    const script = explicitScript || workspace.working
    if (!script?.fullScript) {
      throw new AppError('Cannot score an empty script', 400)
    }

    const creatorStyleDoc = await CreatorStyleProfile.findForChannel(req.workspaceId, channelId)
    if (!creatorStyleDoc) {
      throw new AppError('Creator style profile not built yet — call POST /:channelId/creator-style first', 409)
    }

    const provider = getAIProvider()
    const result = await provider.scoreScriptStyle(
      { channelId, script, creatorStyle: creatorStyleDoc.profile },
      { channelId, feature: 'score-script-style' },
    )

    // Persist the updated score on the workspace.
    const updated = await ScriptWorkspace.patchWorking(workspace._id, {}, { styleMatch: result.styleMatch })

    attachAIHeaders(res)
    res.json({
      success: true,
      data: { workspace: updated, styleMatch: result.styleMatch },
      meta: { feature: 'script-workspace:style-score', requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
}

// ── POST /:channelId/creator-style ──────────────────────────────────────────
// Explicitly builds or refreshes the Creator Style Profile for a channel.
// Pass `regenerate: true` in the body to bypass the cache.
export async function analyzeCreatorStyleController(req, res, next) {
  try {
    const { channelId } = req.params
    const regenerate = req.body?.regenerate === true

    const { channel, videos } = await loadChannelContext(channelId, req.workspaceId, { req })

    let creatorStyleDoc = await CreatorStyleProfile.findForChannel(req.workspaceId, channelId)
    const staleProfile = !creatorStyleDoc
      || (creatorStyleDoc.profileVersion || 1) !== CreatorStyleProfile.CURRENT_PROFILE_VERSION
    if (creatorStyleDoc && !regenerate && !staleProfile) {
      attachAIHeaders(res)
      return res.json({
        success: true,
        data: { creatorStyle: creatorStyleDoc, cached: true },
        meta: { feature: 'creator-style', requestedAt: new Date().toISOString() },
      })
    }

    const provider = getAIProvider()
    const profile = await provider.analyzeCreatorStyle(
      { channelId, channel, videos },
      { channelId, feature: 'analyze-creator-style' },
    )

    creatorStyleDoc = await CreatorStyleProfile.upsertForChannel(
      req.workspaceId,
      channelId,
      profile,
      {
        generatedFromVideoIds: videos.slice(0, 15).map((v) => v.videoId || v._id?.toString()),
        profileVersion: CreatorStyleProfile.CURRENT_PROFILE_VERSION,
      },
    )

    attachAIHeaders(res)
    res.json({
      success: true,
      data: { creatorStyle: creatorStyleDoc, cached: false },
      meta: { feature: 'creator-style', requestedAt: new Date().toISOString() },
    })
  } catch (err) {
    next(err)
  }
}
