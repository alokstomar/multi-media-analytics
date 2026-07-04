// ─────────────────────────────────────────────────────────────────────────
// Research Workspace presentation utilities.
//
// Pure derivation functions — NO new AI scoring logic. Everything here reads
// from the existing backend report shape (claims/suggestions/missingContext/
// researchScore) and produces presentation-layer metadata: priority groups,
// risk levels, confidence badges, "why flagged" explanations, metrics counts.
//
// Backend report shape (untouched):
//   claim:        { id, text, type, verdict, confidence, snippet, field, sources }
//   suggestion:   { id, type, field, find, replace, rationale, confidence, sources, state }
//   missingContext: { topic, why, suggestedAddition, priority }
//   researchScore:  { overall, accuracy, freshness, credibility, citationCoverage }
// ─────────────────────────────────────────────────────────────────────────

export const PRIORITY = {
  CRITICAL:  { key: 'CRITICAL',  label: 'Critical',  weight: 0, tint: 'red' },
  IMPORTANT: { key: 'IMPORTANT', label: 'Important', weight: 1, tint: 'amber' },
  OPTIONAL:  { key: 'OPTIONAL',  label: 'Optional',  weight: 2, tint: 'sky' },
}

export const RISK = {
  LOW:    { key: 'LOW',    label: 'Low Risk',    tint: 'emerald', description: 'Most claims verified; safe to proceed.' },
  MEDIUM: { key: 'MEDIUM', label: 'Medium Risk', tint: 'amber',   description: 'Some claims need editor attention.' },
  HIGH:   { key: 'HIGH',   label: 'High Risk',   tint: 'red',     description: 'Multiple unverified or contradicted claims.' },
}

// ── Verdict → confidence badge mapping ───────────────────────────────────
// verdict is the authoritative signal; confidence is the percentage shown
// alongside the badge. Maps directly to the existing 5-value verdict enum.
export const VERDICT_BADGES = {
  verified: {
    icon: 'check',
    label: 'Verified',
    short: 'VERIFIED',
    tint: 'emerald',
    description: 'Supported by available sources.',
  },
  'needs-citation': {
    icon: 'alert-triangle',
    label: 'Partially Verified',
    short: 'PARTIAL',
    tint: 'amber',
    description: 'Plausible but lacks a strong citation.',
  },
  weak: {
    icon: 'alert-triangle',
    label: 'Weak Support',
    short: 'WEAK',
    tint: 'orange',
    description: 'Sources only partially relate to the claim.',
  },
  false: {
    icon: 'x',
    label: 'Contradicted',
    short: 'FALSE',
    tint: 'red',
    description: 'Available sources contradict this claim.',
  },
  unverified: {
    icon: 'x',
    label: 'Unverified',
    short: 'UNVERIFIED',
    tint: 'gray',
    description: 'No source could be located to confirm.',
  },
}

export function verdictBadge(verdict) {
  return VERDICT_BADGES[verdict] || VERDICT_BADGES.unverified
}

// ── Claim priority derivation ─────────────────────────────────────────────
// Uses existing verdict + confidence — no new classifications.
//   CRITICAL  → 'false' verdict OR confidence < 25
//   IMPORTANT → 'weak' / 'needs-citation' OR confidence 25-60
//   OPTIONAL  → 'verified' / 'unverified' with confidence > 60
export function deriveClaimPriority(claim) {
  const v = claim?.verdict
  const c = Number(claim?.confidence ?? 0)
  if (v === 'false') return PRIORITY.CRITICAL
  if (v === 'weak') return PRIORITY.IMPORTANT
  if (v === 'needs-citation') return PRIORITY.IMPORTANT
  if (c < 25) return PRIORITY.CRITICAL
  if (c < 60) return PRIORITY.IMPORTANT
  return PRIORITY.OPTIONAL
}

// ── Suggestion priority derivation ────────────────────────────────────────
// Suggestion type drives priority — 'remove-hallucination' is always critical.
export function deriveSuggestionPriority(suggestion) {
  const t = suggestion?.type
  if (t === 'remove-hallucination') return PRIORITY.CRITICAL
  if (t === 'fix-statistic' || t === 'fix-date') return PRIORITY.IMPORTANT
  return PRIORITY.OPTIONAL
}

// ── Risk level for the entire report ─────────────────────────────────────
// Weighted blend: count critical claims, factor in overall score, and
// flag 'false' verdicts immediately.
export function deriveRiskLevel(report) {
  const claims = report?.report?.claims || []
  const score = report?.report?.researchScore?.overall ?? 0
  if (claims.length === 0) return RISK.LOW

  const criticalCount = claims.filter((c) => deriveClaimPriority(c) === PRIORITY.CRITICAL).length
  const falseCount = claims.filter((c) => c.verdict === 'false').length
  const unverifiedCount = claims.filter((c) => c.verdict === 'unverified').length
  const unverifiedRatio = unverifiedCount / claims.length

  if (falseCount > 0 || criticalCount >= 2 || score < 30) return RISK.HIGH
  if (criticalCount === 1 || unverifiedRatio > 0.5 || score < 60) return RISK.MEDIUM
  return RISK.LOW
}

// ── Why was this flagged? ─────────────────────────────────────────────────
// Static explanation templates keyed by verdict + claim type. Uses only
// existing backend fields — no new AI scoring. Picks the most specific
// template that applies.
export function deriveWhyFlagged(claim) {
  const v = claim?.verdict
  const t = claim?.type
  const hasSources = Array.isArray(claim?.sources) && claim.sources.length > 0

  if (v === 'false') {
    return 'Available sources contradict this statement. Remove or rewrite before publishing.'
  }
  if (v === 'weak') {
    return hasSources
      ? 'The available source only partially supports this claim — readers may challenge it.'
      : 'No strong source could be found to back this claim.'
  }
  if (v === 'needs-citation') {
    if (t === 'statistic') return 'This statistic needs a citation from a trustworthy source.'
    if (t === 'date') return 'This date reference needs a supporting citation.'
    if (t === 'fact') return 'This factual assertion needs a supporting citation.'
    return 'This claim is plausible but lacks a supporting citation.'
  }
  if (v === 'verified') {
    return 'Verified against at least one supporting source. No action needed.'
  }
  // unverified (default — most common in stub mode)
  if (t === 'statistic') return 'This statistic could not be verified — add a citation or remove it.'
  if (t === 'date') return 'This date could not be verified against an external source.'
  if (t === 'fact') return 'This factual assertion has not been confirmed externally.'
  return hasSources
    ? 'No supporting source could be located for this claim.'
    : 'No external source could be located to confirm this claim.'
}

// ── Metrics counters ──────────────────────────────────────────────────────
// All informational — derived strictly from existing claim.type and
// claim.verdict. No new classifications invented.
export function deriveMetrics(report) {
  const claims = report?.report?.claims || []
  const byVerdict = { verified: 0, 'needs-citation': 0, weak: 0, false: 0, unverified: 0 }
  const byType = { statistic: 0, fact: 0, date: 0, claim: 0 }

  for (const c of claims) {
    if (byVerdict[c.verdict] != null) byVerdict[c.verdict] += 1
    if (byType[c.type] != null) byType[c.type] += 1
  }

  const verified = byVerdict.verified
  const unverified = claims.length - verified
  const needsReview = byVerdict['needs-citation'] + byVerdict.weak + byVerdict.false

  return {
    totalClaims: claims.length,
    verified,
    unverified,
    needsReview,
    statistics: byType.statistic,
    dates: byType.date,
    facts: byType.fact,
    otherClaims: byType.claim,
  }
}

// ── Overall recommendation ────────────────────────────────────────────────
// Editor-facing guidance — picks the most appropriate line based on the
// risk level + counts. Pure presentation.
export function deriveRecommendation(report) {
  const metrics = deriveMetrics(report)
  const risk = deriveRiskLevel(report)
  const suggestionsCount = report?.report?.suggestions?.length || 0

  if (metrics.totalClaims === 0) {
    return 'No factual claims detected — script appears to be opinion or narrative.'
  }

  if (risk.key === 'LOW') {
    return suggestionsCount > 0
      ? 'Safe to publish after reviewing the highlighted suggestions.'
      : 'Safe to publish — claims are well-supported.'
  }
  if (risk.key === 'MEDIUM') {
    return 'Several claims should be verified or cited before publishing.'
  }
  // HIGH
  if (metrics.unverified > metrics.verified) {
    return 'Multiple factual claims require verification before publishing.'
  }
  return 'High-risk content — review critical claims before publishing.'
}

// ── Coverage ──────────────────────────────────────────────────────────────
// Uses the existing researchScore.citationCoverage (0-100). Falls back to
// a derived percentage (claims with sources / total claims) if the field
// is missing.
export function deriveCoverage(report) {
  const claims = report?.report?.claims || []
  if (claims.length === 0) return 0
  const fromScore = report?.report?.researchScore?.citationCoverage
  if (typeof fromScore === 'number' && fromScore >= 0) {
    return Math.round(fromScore)
  }
  const withSources = claims.filter((c) => Array.isArray(c.sources) && c.sources.length > 0).length
  return Math.round((withSources / claims.length) * 100)
}

// ── Group any list by priority ────────────────────────────────────────────
// Returns [{ priority, items }] sorted by weight (CRITICAL first).
export function groupByPriority(items, deriveFn) {
  const buckets = new Map()
  for (const item of items || []) {
    const p = deriveFn(item)
    if (!buckets.has(p.key)) buckets.set(p.key, { priority: p, items: [] })
    buckets.get(p.key).items.push(item)
  }
  return [...buckets.values()].sort((a, b) => a.priority.weight - b.priority.weight)
}

// ── Session-persistent collapse state ─────────────────────────────────────
// Reads/writes sessionStorage so the user's expand preference survives
// reloads within the same browser session.
const COLLAPSE_KEY = 'research-workspace-collapsed'

export function readCollapseState() {
  try {
    return sessionStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeCollapseState(collapsed) {
  try {
    sessionStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  } catch { /* ignore */ }
}

// ── Staged loading messages ───────────────────────────────────────────────
// Cycles through these while isAnalyzing. Pure UI — no relation to actual
// backend steps (which are claim extraction → search → final analysis).
export const LOADING_STAGES = [
  'Extracting factual claims…',
  'Checking consistency…',
  'Evaluating credibility…',
  'Generating suggestions…',
  'Building research report…',
]

// ── Claim type → icon mapping ─────────────────────────────────────────────
// Lucide icon name (string) — components resolve to the actual component.
// Covers the existing backend types (statistic/fact/date/claim) plus a richer
// set for future extraction improvements (person/company/location/quote/movie/
// song/event/website). No new AI logic — purely presentation.
export const CLAIM_TYPE_META = {
  statistic: { icon: 'Hash',        label: 'Statistic' },
  fact:      { icon: 'FileText',    label: 'Fact' },
  date:      { icon: 'Calendar',    label: 'Date' },
  claim:     { icon: 'MessageSquare', label: 'Claim' },
  person:    { icon: 'User',        label: 'Person' },
  company:   { icon: 'Building2',   label: 'Company' },
  location:  { icon: 'MapPin',      label: 'Location' },
  quote:     { icon: 'Quote',       label: 'Quote' },
  movie:     { icon: 'Film',        label: 'Movie' },
  song:      { icon: 'Music',       label: 'Song' },
  event:     { icon: 'Ticket',      label: 'Event' },
  website:   { icon: 'Globe',       label: 'Website' },
}

export function claimTypeMeta(type) {
  return CLAIM_TYPE_META[type] || CLAIM_TYPE_META.claim
}

// ── Suggestion → impact tag mapping ───────────────────────────────────────
// Each rewrite suggestion improves the script in a specific way. Surfacing
// the impact helps the editor prioritize — fixes that "Reduce Hallucination"
// are higher-value than "Clarifies Timeline".
export const SUGGESTION_IMPACT = {
  'fix-statistic':       { icon: 'Target',     label: 'Improves Accuracy',        tint: 'emerald' },
  'fix-date':            { icon: 'Clock',      label: 'Clarifies Timeline',       tint: 'sky' },
  'replace-claim':       { icon: 'RefreshCw',  label: 'Improves Accuracy',        tint: 'emerald' },
  'add-context':         { icon: 'PlusCircle', label: 'Adds Context',             tint: 'violet' },
  'remove-hallucination':{ icon: 'ShieldOff',  label: 'Removes Unsupported Claim', tint: 'red' },
}

export function suggestionImpact(type) {
  return SUGGESTION_IMPACT[type] || { icon: 'Sparkles', label: 'Improves Quality', tint: 'violet' }
}

// ── Publish readiness ─────────────────────────────────────────────────────
// Pure derivation from overall score. Maps the 0-100 number to a 4-stage
// status progression. Each stage has a label, tint, and friendly description.
export const PUBLISH_STATUS = {
  NOT_READY:   { key: 'NOT_READY',   label: 'Not Ready',        tint: 'red',     weight: 0, hint: 'Action required before publishing.' },
  NEEDS_WORK:  { key: 'NEEDS_WORK',  label: 'Needs Work',       tint: 'amber',   weight: 1, hint: 'Several fixes needed before publishing.' },
  ALMOST:      { key: 'ALMOST',      label: 'Almost Ready',     tint: 'sky',     weight: 2, hint: 'A few polish items remain.' },
  READY:       { key: 'READY',       label: 'Ready to Publish', tint: 'emerald', weight: 3, hint: 'Safe to publish — well-researched.' },
}

export function derivePublishStatus(report) {
  const score = report?.report?.researchScore?.overall ?? 0
  if (score >= 80) return PUBLISH_STATUS.READY
  if (score >= 55) return PUBLISH_STATUS.ALMOST
  if (score >= 30) return PUBLISH_STATUS.NEEDS_WORK
  return PUBLISH_STATUS.NOT_READY
}

// Estimated remaining fixes — derived from pending suggestions + missing
// context items. Used by PublishReadinessCard to set expectations.
export function deriveRemainingFixes(report) {
  const suggestions = report?.report?.suggestions || []
  const pending = suggestions.filter((s) => !s.state || s.state === 'pending').length
  const missing = (report?.report?.missingContext || []).length
  return pending + missing
}

// ── Research history (session-persistent) ─────────────────────────────────
// localStorage-backed timeline of {version, score, ts} entries. Each time a
// fresh report arrives, append. Cap to last 20 entries. Keyed per workspace
// (channelId:ideaId) so different scripts don't pollute each other's history.
const HISTORY_KEY_PREFIX = 'research-history:'
const HISTORY_CAP = 20

export function readResearchHistory(channelId, ideaId) {
  if (!channelId || !ideaId) return []
  try {
    const raw = localStorage.getItem(`${HISTORY_KEY_PREFIX}${channelId}:${ideaId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendResearchHistory(channelId, ideaId, entry) {
  if (!channelId || !ideaId || !entry) return readResearchHistory(channelId, ideaId)
  try {
    const existing = readResearchHistory(channelId, ideaId)
    // Dedupe by version (or by ts if version is null). Latest wins.
    const key = (e) => e.version != null ? `v:${e.version}` : `t:${e.ts}`
    const withoutDup = existing.filter((e) => key(e) !== key(entry))
    const next = [...withoutDup, entry].sort((a, b) => {
      if (a.version != null && b.version != null) return a.version - b.version
      return (a.ts || 0) - (b.ts || 0)
    })
    const capped = next.slice(-HISTORY_CAP)
    localStorage.setItem(`${HISTORY_KEY_PREFIX}${channelId}:${ideaId}`, JSON.stringify(capped))
    return capped
  } catch {
    return readResearchHistory(channelId, ideaId)
  }
}

export function clearResearchHistory(channelId, ideaId) {
  if (!channelId || !ideaId) return
  try {
    localStorage.removeItem(`${HISTORY_KEY_PREFIX}${channelId}:${ideaId}`)
  } catch { /* ignore */ }
}

// ── Apply button staged messages ──────────────────────────────────────────
// Cycled sequentially in SuggestionCard while a suggestion is being applied.
// Each stage maps to a specific phase of the network round-trip.
export const APPLY_STAGES = [
  { key: 'applying',   label: 'Applying…',          ms: 0,    icon: 'spinner' },
  { key: 'updating',   label: 'Updating Script…',   ms: 350,  icon: 'spinner' },
  { key: 'refreshing', label: 'Refreshing Research…', ms: 750, icon: 'spinner' },
  { key: 'applied',    label: 'Applied Successfully', ms: 1150, icon: 'check' },
]

