import ScriptWorkspace from '../models/ScriptWorkspace.js'
import ResearchReport from '../models/ResearchReport.js'
import { analyzeScript, hashScript, rescoreOnly } from '../services/research/researchEngine.js'
import { getActiveProviderName } from '../services/ai/index.js'
import { getSearchProviderLabel, isSearchGrounded } from '../services/search/index.js'
import { AppError } from '../utils/errorHandler.js'

function attachAIHeaders(res) {
  res.setHeader('X-AI-Provider', getActiveProviderName())
  res.setHeader('X-AI-Status', 'success')
  res.setHeader('X-Search-Provider', getSearchProviderLabel())
  res.setHeader('X-Search-Grounded', String(isSearchGrounded()))
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

const ALLOWED_FIELDS = ['title', 'hook', 'fullScript', 'cta', 'description']

// Apply a structured suggestion patch to a working object. Mutates a copy
// and returns it. Throws AppError(409) if `find` is not a literal substring
// of the current text — that means the script was edited since the report
// was generated and the suggestion is stale; the UI must re-analyze.
function applySuggestionPatch(working, suggestion) {
  const next = { ...working }
  const field = ALLOWED_FIELDS.includes(suggestion.field) ? suggestion.field : 'fullScript'
  const current = next[field] || ''
  const find = suggestion.find || ''

  if (find && !current.includes(find)) {
    throw new AppError(
      `Cannot apply suggestion — the text "${find.slice(0, 60)}" is no longer in the script. Re-analyze and try again.`,
      409,
    )
  }

  next[field] = find ? current.replace(find, suggestion.replace || '') : current
  return next
}

// ── GET /:channelId/script-workspace/:ideaId/research ──────────────────────
// Returns the cached report if scriptHash matches. Otherwise triggers the
// engine. Body { force: true } forces a re-run regardless of hash.
export async function getResearch(req, res, next) {
  try {
    const { channelId, ideaId } = req.params
    const force = req.body?.force === true

    const workspace = await ScriptWorkspace.findOne({
      workspaceId: req.workspaceId, channelId, ideaId,
    }).lean()

    // Workspace not yet created (race condition: ResearchWorkspace mounts
    // before the parent workspace is persisted). Return empty status so the
    // UI shows "nothing to analyse" instead of crashing with a 404.
    if (!workspace) {
      attachAIHeaders(res)
      return res.json(withMeta({
        report: null,
        status: 'empty',
        scriptHash: null,
        limitedVerification: isSearchGrounded() === false,
        providerUsed: { ai: getActiveProviderName(), search: getSearchProviderLabel() },
      }, 'research:get'))
    }

    if (!workspace.working?.fullScript || workspace.working.fullScript.trim().length === 0) {
      attachAIHeaders(res)
      return res.json(withMeta({
        report: null,
        status: 'empty',
        scriptHash: null,
        limitedVerification: isSearchGrounded() === false,
        providerUsed: { ai: getActiveProviderName(), search: getSearchProviderLabel() },
      }, 'research:get'))
    }

    const currentHash = hashScript(workspace.working)
    const cached = await ResearchReport.findForWorkspace({
      workspaceId: req.workspaceId, channelId, ideaId,
    })

    if (!force && cached && cached.scriptHash === currentHash) {
      attachAIHeaders(res)
      return res.json(withMeta({
        report: cached,
        status: 'cached',
        scriptHash: currentHash,
        limitedVerification: cached.limitedVerification,
        providerUsed: cached.providerUsed,
      }, 'research:get'))
    }

    // Cache miss or hash mismatch — run the engine.
    const report = await analyzeScript({
      workspaceId: req.workspaceId,
      channelId,
      ideaId,
      working: workspace.working,
      userId: req.user?._id,
    })

    attachAIHeaders(res)
    res.json(withMeta({
      report,
      status: cached ? 'refreshed' : 'generated',
      scriptHash: currentHash,
      limitedVerification: report.limitedVerification,
      providerUsed: report.providerUsed,
    }, 'research:get'))
  } catch (err) {
    next(err)
  }
}

// ── POST /:channelId/script-workspace/:ideaId/research/analyze ─────────────
// Force a re-run of the engine against the current workspace script.
export async function analyzeResearch(req, res, next) {
  try {
    const { channelId, ideaId } = req.params

    const workspace = await ScriptWorkspace.findOne({
      workspaceId: req.workspaceId, channelId, ideaId,
    }).lean()
    if (!workspace) throw new AppError('Workspace not found', 404)
    if (!workspace.working?.fullScript?.trim()) {
      throw new AppError('Cannot analyze an empty script', 400)
    }

    const report = await analyzeScript({
      workspaceId: req.workspaceId,
      channelId,
      ideaId,
      working: workspace.working,
      userId: req.user?._id,
    })

    attachAIHeaders(res)
    res.json(withMeta({
      report,
      status: 'generated',
      scriptHash: hashScript(workspace.working),
      limitedVerification: report.limitedVerification,
      providerUsed: report.providerUsed,
    }, 'research:analyze'))
  } catch (err) {
    next(err)
  }
}

// ── POST .../suggestions/:suggestionId/apply ──────────────────────────────
// Apply the patch → push a new version with source='research-suggestion' →
// mark the suggestion applied (with version number) → re-score.
export async function applySuggestion(req, res, next) {
  try {
    const { channelId, ideaId, suggestionId } = req.params

    const workspace = await ScriptWorkspace.findOne({
      workspaceId: req.workspaceId, channelId, ideaId,
    })
    if (!workspace) throw new AppError('Workspace not found', 404)

    const report = await ResearchReport.findForWorkspace({
      workspaceId: req.workspaceId, channelId, ideaId,
    })
    if (!report) throw new AppError('Research report not found — run analysis first', 404)

    const suggestion = report.report.suggestions.find((s) => s.id === suggestionId)
    if (!suggestion) throw new AppError('Suggestion not found', 404)
    if (suggestion.state === 'applied') {
      throw new AppError('Suggestion already applied', 409)
    }

    // 1. Apply the patch to the current working state.
    const newWorking = applySuggestionPatch(workspace.working, suggestion)

    // 2. Push a new version with source='research-suggestion'.
    const updated = await ScriptWorkspace.pushVersion(workspace._id, newWorking, {
      source: 'research-suggestion',
      action: suggestion.type,
      editedBy: req.user?._id,
    })

    const newVersionNumber = updated.versions[updated.versions.length - 1].version

    // 3. Mark the suggestion applied (atomic patch).
    const marked = await ResearchReport.markSuggestionState(
      { workspaceId: req.workspaceId, channelId, ideaId },
      suggestionId,
      'applied',
      newVersionNumber,
    )
    if (!marked) {
      throw new AppError('Suggestion not found — it may have been removed when the report was regenerated', 404)
    }

    // 4. Re-score the report (cheap) against the new working state.
    let refreshedReport
    try {
      refreshedReport = await rescoreOnly({
        workspaceId: req.workspaceId, channelId, ideaId,
        working: newWorking,
        userId: req.user?._id,
      })
    } catch (err) {
      console.warn('[Research] rescoreOnly failed (non-fatal):', err.message)
      refreshedReport = await ResearchReport.findForWorkspace({
        workspaceId: req.workspaceId, channelId, ideaId,
      })
    }

    attachAIHeaders(res)
    res.json(withMeta({
      workspace: updated,
      report: refreshedReport,
      appliedSuggestionId: suggestionId,
      appliedVersion: newVersionNumber,
    }, 'research:apply'))
  } catch (err) {
    next(err)
  }
}

// ── POST .../suggestions/:suggestionId/ignore ─────────────────────────────
export async function ignoreSuggestion(req, res, next) {
  try {
    const { channelId, ideaId, suggestionId } = req.params

    const updated = await ResearchReport.markSuggestionState(
      { workspaceId: req.workspaceId, channelId, ideaId },
      suggestionId,
      'ignored',
    )
    if (!updated) throw new AppError('Report or suggestion not found', 404)

    attachAIHeaders(res)
    res.json(withMeta({
      report: updated,
      ignoredSuggestionId: suggestionId,
    }, 'research:ignore'))
  } catch (err) {
    next(err)
  }
}
