import { motion, AnimatePresence } from 'framer-motion'
import { Rocket, HelpCircle, ArrowRight, AlertTriangle, Inbox } from 'lucide-react'

const IMPACT_COLOR = {
  High: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-gray-50 text-gray-600 border-gray-200',
}

const DIFFICULTY_COLOR = {
  Low: 'bg-emerald-50 text-emerald-700',
  Medium: 'bg-amber-50 text-amber-700',
  High: 'bg-red-50 text-red-700',
}

function Shell({ kind, message }) {
  if (kind === 'loading') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 animate-pulse">
            <div className="h-3 w-40 bg-gray-200 rounded" />
            <div className="mt-2.5 space-y-1.5">
              <div className="h-2.5 bg-gray-100 rounded w-full" />
              <div className="h-2.5 bg-gray-100 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (kind === 'error') {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4 text-center">
        <AlertTriangle className="h-4 w-4 text-red-500 mx-auto mb-1.5" />
        <p className="text-xs font-bold text-red-700">{message || 'Failed to load opportunities'}</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-center">
      <Inbox className="h-4 w-4 text-gray-400 mx-auto mb-1" />
      <p className="text-xs font-bold text-gray-600">No growth opportunities found</p>
    </div>
  )
}

export default function GrowthOpportunitiesPanel({ data, status, error, fallback }) {
  const opportunities = Array.isArray(data?.opportunities) ? data.opportunities : []
  const questions = Array.isArray(data?.unansweredQuestions) ? data.unansweredQuestions : []
  const showShell = status === 'loading' || status === 'error' || (status === 'idle' && !opportunities.length)

  return (
    <div
      className="rounded-[20px] border border-gray-100 bg-white p-5.5 space-y-4"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Rocket className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-bold text-gray-900 tracking-tight leading-snug">
            Growth Opportunities
          </h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
            Content gaps + audience questions
          </p>
        </div>
        {fallback && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Offline
          </span>
        )}
      </div>

      {showShell ? (
        <Shell kind={status === 'idle' ? 'empty' : status} message={error} />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {opportunities.map((o, i) => {
              const impact = o.demand || o.impact || 'Medium'
              const competition = o.competition || 'Medium'
              const iStyle = IMPACT_COLOR[impact] || IMPACT_COLOR.Medium
              const cStyle = DIFFICULTY_COLOR[competition] || DIFFICULTY_COLOR.Medium
              return (
                <motion.div
                  key={o.id || i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
                  className="rounded-2xl border border-gray-100 bg-white p-4 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-[12.5px] font-bold text-gray-900 leading-snug flex-1">{o.title}</p>
                    {typeof o.opportunityScore === 'number' && (
                      <div className="text-right shrink-0">
                        <p className="text-[15px] font-bold text-emerald-600 tabular-nums leading-none">
                          {o.opportunityScore}
                        </p>
                        <p className="text-[8px] uppercase font-bold text-gray-400 tracking-wider mt-0.5">opp score</p>
                      </div>
                    )}
                  </div>
                  {o.rationale && (
                    <p className="text-[11.5px] text-gray-600 leading-relaxed">{o.rationale}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${iStyle}`}>
                      Demand: {impact}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cStyle}`}>
                      Competition: {competition}
                    </span>
                    {Array.isArray(o.tags) && o.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {questions.length > 0 && (
            <div className="rounded-2xl bg-blue-50/50 border border-blue-100 p-3.5 space-y-2">
              <p className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5" />
                Unanswered audience questions
              </p>
              <ul className="space-y-1.5">
                {questions.slice(0, 5).map((q, i) => (
                  <li key={i} className="text-[11px] text-blue-800 leading-relaxed flex items-start gap-1.5">
                    <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-blue-500" />
                    <span className="flex-1">{q.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
