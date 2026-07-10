import { createHash } from 'crypto'
import { getAIProvider } from '../ai/index.js'
import { getSearchProvider, isSearchGrounded, getSearchProviderLabel } from '../search/index.js'
import ResearchReport from '../../models/ResearchReport.js'

// ── hashScript ────────────────────────────────────────────────────────────
// sha256 of working.fullScript + '\n' + working.title. Used as the cache
// key — when the script changes meaningfully, the hash differs and the
// engine re-runs.
export function hashScript(working = {}) {
  const input = `${working.fullScript || ''}\n${working.title || ''}`
  return createHash('sha256').update(input).digest('hex')
}

// ── analyzeScript ──────────────────────────────────────────────────────────
// Single orchestrator function. The controller calls this; it does the full
// pipeline (claim extraction → search → final analysis → upsert) and returns
// the saved report. This is the ONLY consumer of the search provider — the
// controller never touches search directly.
//
// Steps:
//   1. Compute scriptHash
//   2. (Caller may have already short-circuited on a matching cache hit.)
//   3. extractScriptClaims via AI provider
//   4. batchSearch via search provider (returns [] Map in stub mode)
//   5. analyzeScriptResearch via AI provider, with grounding flag
//   6. Compose the report doc + providerUsed + limitedVerification
//   7. Upsert into ResearchReport
//   8. Return the doc
export async function analyzeScript({
  workspaceId,
  channelId,
  ideaId,
  working,
  userId = null,
}) {
  if (!working?.fullScript || working.fullScript.trim().length === 0) {
    throw new Error('Cannot analyze an empty script')
  }

  const scriptHash = hashScript(working)
  const ai = getAIProvider()
  const search = getSearchProvider()
  const configuredGrounded = isSearchGrounded()
  const configuredLabel = getSearchProviderLabel()

  console.log(`[ResearchEngine] analyzeScript start`, {
    workspaceId, channelId, ideaId, scriptHash: scriptHash.slice(0, 12), grounded: configuredGrounded,
  })

  // ── Step 3: extract claims ──────────────────────────────────────────────
  const claims = await ai.extractScriptClaims(
    { script: working },
    { channelId, feature: 'extract-script-claims', userId },
  )
  console.log(`[ResearchEngine] extractScriptClaims → ${claims.length} claim(s)`)

  // ── Step 4: batch search (no-op in stub mode) ───────────────────────────
  // De-duplicate claims by text before firing searches — multiple claims
  // with the same text share results. The Tavily provider also caches by
  // query, so identical claims across runs don't re-hit the API.
  const uniqueClaimTexts = [...new Set(claims.map((c) => c.text))]
  const searchResultsMap = await search.batchSearch(uniqueClaimTexts)
  console.log(`[ResearchEngine] batchSearch → ${searchResultsMap.size} result set(s) via ${configuredLabel}`)

  // ── Degraded-mode detection ─────────────────────────────────────────────
  // If a grounded provider (Tavily) hit consecutive failures during the
  // batch, fall back to AI-only analysis for this run. The report is marked
  // so the UI surfaces the fallback message instead of the live banner.
  const degraded = typeof search.isDegraded === 'function' && search.isDegraded()
  const effectiveGrounded = configuredGrounded && !degraded
  const effectiveLabel = degraded ? 'stub-fallback' : configuredLabel

  if (degraded) {
    console.warn(
      `[ResearchEngine] search provider degraded (${search.lastError || 'unknown error'}) — falling back to AI-only analysis for this run`,
    )
  }

  // ── Step 5: final analysis pass ─────────────────────────────────────────
  const analysis = await ai.analyzeScriptResearch(
    {
      script: working,
      claims,
      searchResults: searchResultsMap,
      grounded: effectiveGrounded,
      channelId,
    },
    { channelId, feature: 'analyze-script-research', userId },
  )
  console.log(`[ResearchEngine] analyzeScriptResearch → score=${analysis?.researchScore?.overall ?? 'n/a'}`)

  // ── Verification stats log ──────────────────────────────────────────────
  const verdictCounts = { verified: 0, 'needs-citation': 0, weak: 0, false: 0, unverified: 0 }
  let sourcesCount = 0
  for (const c of analysis?.claims || []) {
    if (c.verdict && verdictCounts[c.verdict] != null) verdictCounts[c.verdict] += 1
    sourcesCount += Array.isArray(c.sources) ? c.sources.length : 0
  }
  const verifiedCount = verdictCounts.verified
  const needsReviewCount = verdictCounts['needs-citation'] + verdictCounts.weak + verdictCounts.false
  console.log(`[Search]\n  Provider: ${effectiveLabel}\n  Claims: ${claims.length}\n  Verified: ${verifiedCount}\n  Needs Review: ${needsReviewCount}\n  Sources: ${sourcesCount}`)

  // ── Step 6: compose report doc ──────────────────────────────────────────
  // Stable suggestion ids based on the find string — keeps ids deterministic
  // across re-analyzes of the same script, so frontend React keys stay stable.
  const suggestions = (analysis.suggestions || []).map((s) => ({
    ...s,
    id: s.id || `rec_${createHash('sha1').update(s.find || s.rationale || JSON.stringify(s)).digest('hex').slice(0, 12)}`,
    state: 'pending',
    appliedVersion: null,
  }))

  const report = {
    scriptHash,
    report: {
      claims: analysis.claims || [],
      suggestions,
      missingContext: analysis.missingContext || [],
      researchScore: analysis.researchScore || { overall: 0 },
    },
    providerUsed: {
      ai: 'deepseek',
      search: effectiveLabel,
    },
    limitedVerification: !effectiveGrounded,
    generatedAt: new Date(),
    analyzedAt: new Date(),
  }

  // ── Step 7: upsert ──────────────────────────────────────────────────────
  const saved = await ResearchReport.upsertReport(
    { workspaceId, channelId, ideaId },
    report,
  )
  console.log(`[ResearchEngine] report saved — doc._id=${saved._id}`)

  return saved
}

// ── rescoreOnly ────────────────────────────────────────────────────────────
// Cheap re-score pass on the current report — re-runs ONLY the scoring
// portion of analyzeScriptResearch using existing claims + sources. Useful
// after a suggestion is applied (script changed but claims didn't).
//
// Implementation note: this calls analyzeScriptResearch again with the same
// inputs but the (now updated) script. The AI is fast at scoring — the
// expensive part was claim extraction and search, both of which we skip.
export async function rescoreOnly({ workspaceId, channelId, ideaId, working, userId = null }) {
  const existing = await ResearchReport.findForWorkspace({ workspaceId, channelId, ideaId })
  if (!existing) {
    throw new Error('No existing report to rescore — call analyzeScript first')
  }

  const ai = getAIProvider()
  const analysis = await ai.analyzeScriptResearch(
    {
      script: working,
      claims: existing.report.claims.map((c) => ({
        id: c.id, text: c.text, type: c.type, snippet: c.snippet, field: c.field,
      })),
      searchResults: new Map(), // skip search on rescore
      grounded: false,          // don't pretend we re-verified
      channelId,
    },
    { channelId, feature: 'analyze-script-research', userId },
  )

  const updated = await ResearchReport.upsertReport(
    { workspaceId, channelId, ideaId },
    {
      'report.researchScore': analysis.researchScore || existing.report.researchScore,
      analyzedAt: new Date(),
    },
  )
  return updated
}
