import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import {
  ChevronDown, HelpCircle, ExternalLink, Check, X,
  Hash, Calendar, FileText, MessageSquare, User, Building2, MapPin,
  Quote, Film, Music, Ticket, Globe,
} from 'lucide-react'
import ConfidenceBadge from './ConfidenceBadge'
import {
  deriveWhyFlagged, deriveClaimPriority, claimTypeMeta,
} from './researchUtils'

// Resolve the string icon name from CLAIM_TYPE_META to an actual lucide
// component. Falls back to MessageSquare for safety.
const ICON_REGISTRY = {
  Hash, Calendar, FileText, MessageSquare, User, Building2, MapPin,
  Quote, Film, Music, Ticket, Globe,
}

const PRIORITY_TINT = {
  CRITICAL:  { dot: 'bg-red-500',    label: 'text-red-700',    chip: 'bg-red-50 text-red-700 border-red-200' },
  IMPORTANT: { dot: 'bg-amber-500',  label: 'text-amber-700',  chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  OPTIONAL:  { dot: 'bg-sky-500',    label: 'text-sky-700',    chip: 'bg-sky-50 text-sky-700 border-sky-200' },
}

// Tint for the type icon. Pulled from the existing palette — no new colors.
const TYPE_TINT = 'bg-violet-50 text-violet-600'

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

// Expanded claim detail panel — shows the original claim, confidence,
// risk level, reason (Why was this flagged?), and the editor's action
// buttons (Apply / Ignore) when a suggested rewrite exists.
//
// A type-specific icon (stat/date/fact/person/etc.) appears beside every
// claim row, making the claim kind scannable at a glance.
export default function ClaimCard({ claim, suggestion = null, onApply, onIgnore, isApplying = false, onJumpTo }) {
  const [expanded, setExpanded] = useState(false)
  const why = deriveWhyFlagged(claim)
  const priority = deriveClaimPriority(claim)
  const priorityTint = PRIORITY_TINT[priority.key]
  const typeMeta = claimTypeMeta(claim?.type)
  const TypeIcon = ICON_REGISTRY[typeMeta.icon] || MessageSquare

  const hasSources = Array.isArray(claim.sources) && claim.sources.length > 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-gray-100 bg-white overflow-hidden"
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-3.5 py-3 hover:bg-gray-50/50 transition cursor-pointer"
      >
        <div className="flex items-start gap-2.5">
          {/* Type icon — replaces the plain priority dot, communicates claim kind */}
          <div className="flex items-start gap-1.5 shrink-0">
            <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${TYPE_TINT}`} title={typeMeta.label}>
              <TypeIcon className="h-3.5 w-3.5" />
            </div>
            <span className={`mt-2 h-1.5 w-1.5 rounded-full ${priorityTint.dot}`} title={`${priority.label} priority`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-gray-800 font-medium leading-snug">{claim.text}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <ConfidenceBadge verdict={claim.verdict} confidence={claim.confidence} size="sm" />
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {typeMeta.label}
              </span>
              {claim.field && (
                <span className="text-[10px] font-semibold text-gray-400 capitalize">· {claim.field}</span>
              )}
              {hasSources && (
                <span className="text-[10px] font-semibold text-sky-700">
                  · {claim.sources.length} source{claim.sources.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
          <ChevronDown className={`h-3.5 w-3.5 text-gray-400 shrink-0 mt-1 transition ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className="px-3.5 py-3 space-y-3 bg-gray-50/40">
              {/* Detail row: risk level */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">Risk Level</span>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${priorityTint.chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${priorityTint.dot}`} />
                    {priority.label}
                  </span>
                </div>
                <span className="text-[10.5px] text-gray-500">
                  Confidence <span className="font-bold text-gray-700 tabular-nums">{Math.round(claim.confidence || 0)}%</span>
                </span>
              </div>

              {/* Snippet from script */}
              {claim.snippet && (
                <div className="rounded-lg border border-gray-100 bg-white px-2.5 py-1.5">
                  <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">In Script</p>
                  <p className="text-[11.5px] text-gray-700 italic leading-snug">"{claim.snippet}"</p>
                  {onJumpTo && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onJumpTo(claim.field, claim.snippet) }}
                      className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-violet-600 hover:text-violet-700 cursor-pointer"
                    >
                      Jump to in editor
                      <ChevronDown className="h-3 w-3 -rotate-90" />
                    </button>
                  )}
                </div>
              )}

              {/* Why was this flagged? */}
              <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-2.5 py-2">
                <div className="flex items-start gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9.5px] font-bold text-amber-700 uppercase tracking-wider mb-0.5">Why was this flagged?</p>
                    <p className="text-[11.5px] text-gray-700 leading-snug">{why}</p>
                  </div>
                </div>
              </div>

              {/* Sources (if any) */}
              {hasSources && (
                <div className="space-y-1.5">
                  <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">Supporting Sources</p>
                  {claim.sources.map((s, i) => (
                    <a
                      key={s.url + i}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-1.5 text-[11.5px] text-sky-700 hover:text-sky-900 leading-snug group"
                    >
                      <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 opacity-60 group-hover:opacity-100" />
                      <span className="min-w-0">
                        <span className="font-semibold">{s.title || domainOf(s.url)}</span>
                        <span className="text-gray-500"> — {domainOf(s.url)}</span>
                        {s.publishedDate && <span className="text-gray-400"> · {s.publishedDate}</span>}
                      </span>
                    </a>
                  ))}
                </div>
              )}

              {/* Suggested rewrite (when present) */}
              {suggestion && suggestion.find && (
                <div className="rounded-lg border border-gray-100 bg-white overflow-hidden">
                  <div className="px-2.5 py-1.5 border-b border-gray-100 bg-red-50/30">
                    <p className="text-[9.5px] font-bold text-red-500 uppercase tracking-wider mb-0.5">Current</p>
                    <p className="text-[11.5px] text-gray-700 leading-snug line-through decoration-red-300/60">{suggestion.find}</p>
                  </div>
                  <div className="px-2.5 py-1.5 bg-emerald-50/30">
                    <p className="text-[9.5px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">Suggested Rewrite</p>
                    {suggestion.replace ? (
                      <p className="text-[11.5px] text-gray-800 leading-snug font-medium">{suggestion.replace}</p>
                    ) : (
                      <p className="text-[11.5px] text-gray-500 leading-snug italic">(remove this text)</p>
                    )}
                  </div>
                </div>
              )}

              {/* Action footer */}
              {suggestion && suggestion.state === 'pending' && (
                <div className="flex items-center justify-end gap-2 pt-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); onIgnore?.(suggestion.id) }}
                    disabled={isApplying}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                  >
                    <X className="h-3 w-3" /> Ignore
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onApply?.(suggestion.id) }}
                    disabled={isApplying}
                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-600 to-violet-700 px-2.5 py-1 text-[11px] font-bold text-white hover:from-violet-700 hover:to-violet-800 disabled:opacity-60 cursor-pointer"
                  >
                    <Check className="h-3 w-3" /> Apply Rewrite
                  </button>
                </div>
              )}
              {suggestion && suggestion.state === 'applied' && (
                <div className="flex items-center gap-1.5 pt-0.5 text-emerald-700">
                  <Check className="h-3.5 w-3.5" />
                  <p className="text-[11px] font-bold">Applied — version {suggestion.appliedVersion}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
