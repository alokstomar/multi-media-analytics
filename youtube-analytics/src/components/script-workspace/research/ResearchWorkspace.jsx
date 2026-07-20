import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, Loader2, AlertCircle, Microscope, ListChecks, FileQuestion,
  BookOpen, ChevronDown, Sparkles, Lightbulb,
} from 'lucide-react'
import { useResearchWorkspace } from './useResearchWorkspace'
import ExecutiveSummaryCard from './ExecutiveSummaryCard'
import PublishReadinessCard from './PublishReadinessCard'
import ResearchHistoryCard from './ResearchHistoryCard'
import MetricsStrip from './MetricsStrip'
import CoverageWidget from './CoverageWidget'
import LimitedVerificationBadge from './LimitedVerificationBadge'
import LiveVerificationBadge from './LiveVerificationBadge'
import ClaimList from './ClaimList'
import SuggestionCard from './SuggestionCard'
import PriorityGroup from './PriorityGroup'
import MissingContextList from './MissingContextList'
import SourcesList from './SourcesList'
import EmptyResearchState from './EmptyResearchState'
import ResearchLoadingShell from './ResearchLoadingShell'
import {
  readCollapseState, writeCollapseState,
  deriveMetrics, deriveRiskLevel, deriveSuggestionPriority, groupByPriority,
  readResearchHistory, appendResearchHistory,
} from './researchUtils'

function wordCount(text) {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0
}

// Compact summary chips shown in the collapsed header. Keeps the editor
// oriented without expanding the full workspace. Pure presentation of
// derived metrics — no new scoring logic.
function CollapsedSummary({ report, limitedVerification, providerUsed }) {
  const metrics = deriveMetrics(report)
  const risk = deriveRiskLevel(report)
  const overall = report?.report?.researchScore?.overall ?? null
  const suggestionCount = report?.report?.suggestions?.length || 0

  const tintForRisk = {
    LOW: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    MEDIUM: 'bg-amber-50 text-amber-700 border-amber-100',
    HIGH: 'bg-red-50 text-red-700 border-red-100',
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {overall != null && (
        <span className="inline-flex items-center gap-1 rounded-md border border-gray-100 bg-gray-50 px-1.5 py-0.5 text-[10px] font-bold text-gray-700 tabular-nums">
          Score <span className="text-gray-900">{Math.round(overall)}</span>
        </span>
      )}
      <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${tintForRisk[risk.key] || tintForRisk.MEDIUM}`}>
        {risk.label}
      </span>
      <span className="inline-flex items-center gap-1 rounded-md border border-gray-100 bg-gray-50 px-1.5 py-0.5 text-[10px] font-bold text-gray-700 tabular-nums">
        {metrics.verified}/{metrics.totalClaims} verified
      </span>
      {suggestionCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md border border-violet-100 bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 tabular-nums">
          {suggestionCount} fix{suggestionCount === 1 ? '' : 'es'}
        </span>
      )}
      {limitedVerification && (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
          Stub
        </span>
      )}
      {providerUsed?.search && (
        <span className="text-[10px] text-gray-400 font-mono">
          {providerUsed.search}
        </span>
      )}
    </div>
  )
}

function SectionLabel({ Icon, children, count, tint = 'text-gray-700' }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`h-3.5 w-3.5 ${tint}`} />
      <h4 className="text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
        {children}
      </h4>
      {count != null && (
        <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 tabular-nums">
          {count}
        </span>
      )}
    </div>
  )
}

export default function ResearchWorkspace({
  channelId,
  ideaId,
  working,
  currentVersion = null,
  onSuggestionApplied,
  onJumpTo,
  onReportChange,
}) {
  const {
    status,
    report,
    limitedVerification,
    providerUsed,
    stale,
    isAnalyzing,
    applyingSuggestionId,
    enoughContent,
    analyze,
    applySuggestion,
    ignoreSuggestion,
    error,
  } = useResearchWorkspace({ channelId, ideaId, working, enabled: true })

  // Collapse persists across reloads within the same browser session.
  const [collapsed, setCollapsed] = useState(() => readCollapseState())

  // Research history — localStorage-backed. Appended whenever a fresh report
  // arrives with a non-null overall score. The localStorage write is impure
  // (Date.now() + localStorage.setItem), so it lives in a useEffect.
  const [history, setHistory] = useState(() => readResearchHistory(channelId, ideaId))
  const [historyKey, setHistoryKey] = useState(`${channelId}:${ideaId}`)
  const [trackedScore, setTrackedScore] = useState(null)

  // Persist collapse preference.
  useEffect(() => {
    writeCollapseState(collapsed)
  }, [collapsed])

  // Lift report state up to parent (for ContentHealthCard). Pure side-effect —
  // does not call setState in this component, so the lint rule is satisfied.
  useEffect(() => {
    onReportChange?.(report)
  }, [report, onReportChange])

  // When workspace identity changes, re-read history from storage and reset
  // the score tracker. Uses the React "adjusting state when prop changes"
  // pattern (state, not refs — render-safe).
  const currentKey = `${channelId}:${ideaId}`
  if (historyKey !== currentKey) {
    setHistoryKey(currentKey)
    setHistory(readResearchHistory(channelId, ideaId))
    setTrackedScore(null)
  }

  // When the report's overall score changes, append a snapshot to the
  // localStorage-backed history. Side effect — uses Date.now() and writes
  // to localStorage, both impure operations that must run in an effect.
  const overallScore = report?.report?.researchScore?.overall
  const reportHash = report?.scriptHash || report?._id || null
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (overallScore == null) return
    if (trackedScore === overallScore) return
    setTrackedScore(overallScore)
    const next = appendResearchHistory(channelId, ideaId, {
      version: currentVersion,
      score: Math.round(overallScore),
      ts: Date.now(),
      hash: reportHash,
    })
    setHistory(next)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [overallScore, reportHash, currentVersion, channelId, ideaId, trackedScore])

  const reportData = report?.report
  const hasReport = !!reportData
  const needsAnalysis = status === 'needs-analysis' && !hasReport
  const showEmpty = !enoughContent && status !== 'loading' && status !== 'needs-analysis' && !hasReport
  const words = wordCount(working?.fullScript)

  // Empty-state variant logic: distinguish "no claims detected" from "all clear".
  let emptyVariant = 'waiting'
  if (enoughContent && hasReport) {
    const claims = reportData.claims || []
    const suggestions = reportData.suggestions || []
    if (claims.length === 0) emptyVariant = 'no-claims'
    else if (suggestions.length === 0 && claims.every((c) => c.verdict === 'verified')) emptyVariant = 'all-clear'
  }

  const handleApply = async (suggestionId) => {
    const updatedWorkspace = await applySuggestion(suggestionId)
    if (onSuggestionApplied && updatedWorkspace) {
      onSuggestionApplied(updatedWorkspace)
    }
  }

  // Group suggestions by priority for CRITICAL → IMPORTANT → OPTIONAL ordering.
  const suggestionGroups = hasReport
    ? groupByPriority(reportData.suggestions || [], deriveSuggestionPriority)
    : []

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-gray-100 bg-white overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
    >
      {/* Header — always visible */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 min-w-0 cursor-pointer group"
          aria-expanded={!collapsed}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
            <Microscope className="h-4 w-4" />
          </div>
          <div className="min-w-0 text-left">
            <h3 className="text-[13.5px] font-bold text-gray-900 truncate group-hover:text-gray-700">
              Research Workspace
            </h3>
            <p className="text-[10.5px] text-gray-500 leading-none mt-0.5 truncate">
              {limitedVerification ? 'AI-only verification' : 'Grounded fact-checks'}
              {providerUsed?.search ? ` · ${providerUsed.search}` : ''}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          />
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {collapsed && hasReport && (
            <CollapsedSummary
              report={report}
              limitedVerification={limitedVerification}
              providerUsed={providerUsed}
            />
          )}
          <button
            onClick={() => analyze()}
            disabled={!enoughContent || isAnalyzing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[10.5px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            title={stale ? 'Script changed — re-analyze for fresh results' : 'Re-run research'}
          >
            {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            <span className="hidden sm:inline">
              {isAnalyzing ? 'Analyzing…' : (status === 'needs-analysis' && !hasReport) ? 'Analyze' : stale ? 'Re-analyze' : 'Refresh'}
            </span>
          </button>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-4 sm:p-5 space-y-4">
              {/* Empty — script too short */}
              {showEmpty && (
                <EmptyResearchState
                  variant="too-short"
                  wordCount={words}
                  threshold={1}
                />
              )}

              {/* First-load skeleton */}
              {!showEmpty && status === 'loading' && !hasReport && (
                <ResearchLoadingShell />
              )}

              {/* Hard error */}
              {!showEmpty && status === 'error' && (
                <div className="rounded-xl border border-red-100 bg-red-50/60 p-4 text-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mx-auto mb-2" />
                  <p className="text-[12px] font-semibold text-red-700">Research failed to load.</p>
                  <p className="text-[11px] text-red-600/80 mt-0.5">
                    {error?.response?.data?.error?.message || error?.message || 'Try again in a moment.'}
                  </p>
                </div>
              )}

              {/* Needs analysis — script has content but no cached report yet */}
              {!showEmpty && needsAnalysis && (
                <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-5 text-center">
                  <Sparkles className="h-5 w-5 text-sky-400 mx-auto mb-2" />
                  <p className="text-[12px] font-semibold text-sky-800">Script is ready to analyze.</p>
                  <p className="text-[11px] text-sky-700/80 mt-0.5 mb-3">Click Analyze to run fact-checking and get improvement suggestions.</p>
                  <button
                    onClick={() => analyze()}
                    disabled={isAnalyzing}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50 transition cursor-pointer shadow-sm"
                  >
                    {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {isAnalyzing ? 'Analyzing…' : 'Analyze'}
                  </button>
                </div>
              )}

              {/* Report loaded */}
              {hasReport && (
                <>
                  {/* Empty-report variant (no claims / all clear) */}
                  {emptyVariant === 'no-claims' || emptyVariant === 'all-clear' ? (
                    <EmptyResearchState variant={emptyVariant} />
                  ) : (
                    <>
                      {limitedVerification ? (
                        <LimitedVerificationBadge provider={providerUsed?.search} />
                      ) : (
                        providerUsed?.search && providerUsed.search !== 'stub' && (
                          <LiveVerificationBadge provider={providerUsed.search} />
                        )
                      )}

                      {stale && (
                        <div className="rounded-xl border border-sky-100 bg-sky-50 px-3.5 py-2.5 text-[11.5px] text-sky-800 flex items-center gap-2">
                          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            Script changed since last analysis. Click <span className="font-bold">Re-analyze</span> for fresh results.
                          </span>
                        </div>
                      )}

                      {/* Hero summary — replaces the old score ring */}
                      <ExecutiveSummaryCard report={report} />

                      {/* Publish readiness + Research history side-by-side on wide screens */}
                      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
                        <PublishReadinessCard report={report} />
                        <ResearchHistoryCard history={history} latestScore={overallScore} />
                      </div>

                      {/* Metrics + Coverage side-by-side on wide screens */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <MetricsStrip report={report} />
                        <CoverageWidget report={report} limitedVerification={limitedVerification} />
                      </div>

                      {/* Suggestions grouped by priority */}
                      {suggestionGroups.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <SectionLabel Icon={ListChecks} tint="text-violet-600" count={reportData.suggestions.length}>
                            Suggestions
                          </SectionLabel>
                          {suggestionGroups.map(({ priority, items }) => (
                            <PriorityGroup
                              key={priority.key}
                              priority={priority}
                              items={items}
                              defaultOpen={priority.key === 'CRITICAL' || priority.key === 'IMPORTANT'}
                            >
                              {items.map((s) => (
                                <SuggestionCard
                                  key={s.id}
                                  suggestion={s}
                                  isApplying={applyingSuggestionId === s.id}
                                  onApply={() => handleApply(s.id)}
                                  onIgnore={() => ignoreSuggestion(s.id)}
                                />
                              ))}
                            </PriorityGroup>
                          ))}
                        </div>
                      )}

                      {/* Claims (ClaimList already groups by priority internally) */}
                      {Array.isArray(reportData.claims) && reportData.claims.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <SectionLabel Icon={FileQuestion} tint="text-sky-600" count={reportData.claims.length}>
                            Claims
                          </SectionLabel>
                          <ClaimList
                            claims={reportData.claims}
                            suggestions={reportData.suggestions}
                            onApply={(id) => handleApply(id)}
                            onIgnore={(id) => ignoreSuggestion(id)}
                            onJumpTo={onJumpTo}
                            applyingSuggestionId={applyingSuggestionId}
                          />
                        </div>
                      )}

                      {/* Missing context — advisory only */}
                      {Array.isArray(reportData.missingContext) && reportData.missingContext.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <SectionLabel Icon={Lightbulb} tint="text-amber-600" count={reportData.missingContext.length}>
                            Missing Context
                          </SectionLabel>
                          <MissingContextList items={reportData.missingContext} />
                        </div>
                      )}

                      {/* Sources — future-ready for live search providers */}
                      <div className="space-y-2 pt-1">
                        <SectionLabel Icon={BookOpen} tint="text-emerald-600">
                          Sources
                        </SectionLabel>
                        <SourcesList report={report} limitedVerification={limitedVerification} />
                      </div>

                      {/* Soft footer — gentle reminder nothing's actionable */}
                      <div className="flex items-center gap-1.5 pt-1 text-[10.5px] text-gray-400">
                        <Sparkles className="h-3 w-3" />
                        <span>
                          Research is advisory — applying a suggestion creates a new script version.
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}
