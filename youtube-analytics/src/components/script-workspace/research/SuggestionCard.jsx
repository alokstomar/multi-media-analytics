import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Check, X, Loader2, ArrowRight, Sparkles, Calendar, Hash, AlertOctagon,
  FileText, Lightbulb, GitPullRequest,
} from 'lucide-react'
import ConfidenceBadge from './ConfidenceBadge'
import {
  deriveSuggestionPriority, suggestionImpact, APPLY_STAGES,
} from './researchUtils'

const TYPE_META = {
  'fix-statistic':        { Icon: Hash,           label: 'Fix Statistic' },
  'fix-date':             { Icon: Calendar,       label: 'Fix Date' },
  'replace-claim':        { Icon: ArrowRight,     label: 'Replace Claim' },
  'add-context':          { Icon: FileText,       label: 'Add Context' },
  'remove-hallucination': { Icon: AlertOctagon,   label: 'Remove Hallucination' },
}

const PRIORITY_TINT = {
  CRITICAL:  { dot: 'bg-red-500',   chip: 'bg-red-50 text-red-700 border-red-200',     ring: 'border-red-100' },
  IMPORTANT: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200', ring: 'border-amber-100' },
  OPTIONAL:  { dot: 'bg-sky-500',   chip: 'bg-sky-50 text-sky-700 border-sky-200',     ring: 'border-sky-100' },
}

// Impact tag visual treatment. Tints come from existing palette only.
const IMPACT_TINT = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  red:     'bg-red-50 text-red-700 border-red-200',
  sky:     'bg-sky-50 text-sky-700 border-sky-200',
  violet:  'bg-violet-50 text-violet-700 border-violet-200',
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

// GitHub-PR-style suggestion card with impact tag + staged Apply.
//
// Stages the Apply button transitions through:
//   Applying… → Updating Script… → Refreshing Research… → Applied Successfully
//
// Stage transitions are theater — they cycle on a timer for sense of progress.
// If the network call resolves before the timer reaches the final stage, we
// jump to "Applied Successfully" early. Total animation kept under 2 seconds.
export default function SuggestionCard({
  suggestion,
  isApplying = false,
  onApply,
  onIgnore,
}) {
  // Staged transitions are driven from the click handler, not effect sync.
  // -1 = idle, 0..N = APPLY_STAGES indices.
  const [stageIndex, setStageIndex] = useState(-1)
  const theaterRef = useRef(null)
  const finalRef = useRef(null)
  const inFlightRef = useRef(false)

  // Cleanup any running timers on unmount.
  useEffect(() => {
    return () => {
      if (theaterRef.current) clearInterval(theaterRef.current)
      if (finalRef.current) clearTimeout(finalRef.current)
    }
  }, [])

  // Click handler — kicks off both the network call and the theater cycle.
  // The cycle pauses on the "refreshing" stage until the network resolves,
  // then jumps to "applied" briefly before resetting to idle.
  const handleApplyClick = async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setStageIndex(0)
    theaterRef.current = setInterval(() => {
      setStageIndex((i) => {
        if (i >= APPLY_STAGES.length - 2) return i // hold on "refreshing"
        return i + 1
      })
    }, 400)

    try {
      await Promise.resolve(onApply?.())
    } catch {
      // swallow — applied/ignored state will not flip; reset theater
    } finally {
      if (theaterRef.current) clearInterval(theaterRef.current)
      setStageIndex(APPLY_STAGES.length - 1)
      finalRef.current = setTimeout(() => {
        setStageIndex(-1)
        inFlightRef.current = false
      }, 1200)
    }
  }

  if (!suggestion) return null
  const meta = TYPE_META[suggestion.type] || TYPE_META['replace-claim']
  const Icon = meta.Icon
  const priority = deriveSuggestionPriority(suggestion)
  const tint = PRIORITY_TINT[priority.key]
  const impact = suggestionImpact(suggestion.type)

  // Suggestions don't have a verdict field, but they do have confidence +
  // sources. Treat confidence >= 60 as "verified-ish", 30-60 as partial,
  // < 30 as unverified — purely for badge display.
  const fakeVerdict = suggestion.confidence >= 60 ? 'verified' : suggestion.confidence >= 30 ? 'needs-citation' : 'unverified'

  const isPending = suggestion.state === 'pending'
  const isApplied = suggestion.state === 'applied'
  const isIgnored = suggestion.state === 'ignored'

  // Active stage label (when applying)
  const activeStage = stageIndex >= 0 ? APPLY_STAGES[stageIndex] : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-xl border bg-white overflow-hidden transition ${
        isApplied ? 'border-emerald-200 bg-emerald-50/30'
        : isIgnored ? 'border-gray-100 opacity-60'
        : tint.ring
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-gray-100 bg-gray-50/40">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider truncate">{meta.label}</span>
          <span className="text-[10px] text-gray-400 capitalize">· {suggestion.field}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${tint.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tint.dot}`} />
            {priority.label}
          </span>
          <ConfidenceBadge verdict={fakeVerdict} confidence={suggestion.confidence} size="sm" showLabel={false} />
        </div>
      </div>

      <div className="p-3.5 space-y-2.5">
        {/* Reason */}
        {suggestion.rationale && (
          <div className="flex items-start gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11.5px] text-gray-600 leading-relaxed flex-1">
              <span className="font-bold text-gray-700">Why: </span>
              {suggestion.rationale}
            </p>
          </div>
        )}

        {/* Impact tag — what this suggestion improves */}
        {isPending && (
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${IMPACT_TINT[impact.tint] || IMPACT_TINT.violet}`}>
            <Sparkles className="h-2.5 w-2.5" />
            {impact.label}
          </div>
        )}

        {/* Diff view — GitHub PR style */}
        <div className="rounded-lg border border-gray-100 overflow-hidden font-mono">
          {suggestion.find && (
            <div className="px-3 py-2 bg-red-50/40 border-b border-gray-100">
              <p className="text-[9.5px] font-bold text-red-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <X className="h-2.5 w-2.5" /> Current
              </p>
              <p className="text-[11.5px] text-gray-700 leading-snug">{suggestion.find}</p>
            </div>
          )}
          <div className="px-3 py-2 bg-emerald-50/40">
            <p className="text-[9.5px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <Check className="h-2.5 w-2.5" /> {suggestion.replace ? 'Suggested' : 'Action'}
            </p>
            {suggestion.replace ? (
              <p className="text-[11.5px] text-gray-800 leading-snug font-medium">{suggestion.replace}</p>
            ) : (
              <p className="text-[11.5px] text-gray-500 leading-snug italic">Remove this text entirely</p>
            )}
          </div>
        </div>

        {/* Sources */}
        {Array.isArray(suggestion.sources) && suggestion.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <p className="w-full text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Supporting Sources</p>
            {suggestion.sources.slice(0, 4).map((s, i) => (
              <a
                key={s.url + i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-100 px-2 py-0.5 text-[10.5px] font-semibold text-sky-700 hover:bg-sky-100"
              >
                <Sparkles className="h-2.5 w-2.5" />
                {domainOf(s.url)}
              </a>
            ))}
          </div>
        )}

        {/* Actions */}
        {isPending && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <GitPullRequest className="h-3 w-3" />
              <span>PR-style suggestion</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onIgnore}
                disabled={isApplying || stageIndex >= 0}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
              >
                <X className="h-3 w-3" /> Ignore
              </button>
              <button
                onClick={handleApplyClick}
                disabled={isApplying || stageIndex >= 0}
                className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-600 to-violet-700 px-3 py-1 text-[11px] font-bold text-white hover:from-violet-700 hover:to-violet-800 transition shadow-sm shadow-violet-500/20 disabled:opacity-80 disabled:cursor-not-allowed cursor-pointer min-w-[140px] justify-center"
              >
                {activeStage ? (
                  <>
                    {activeStage.icon === 'check' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    {activeStage.label}
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3" /> Apply suggestion
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {isApplied && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 pt-1 border-t border-emerald-100"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-3 w-3" />
            </div>
            <p className="text-[11px] font-bold text-emerald-700">
              Applied — version {suggestion.appliedVersion}
            </p>
          </motion.div>
        )}
        {isIgnored && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
            <X className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-[11px] font-semibold text-gray-500">Ignored</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
