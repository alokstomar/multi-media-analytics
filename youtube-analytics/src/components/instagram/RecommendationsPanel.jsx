import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Lightbulb, ArrowRight, AlertTriangle, Inbox, RotateCw } from 'lucide-react'

/* Priority badge mapping — impact comes from the backend (High/Medium/Low).
   Falls back to neutral styling when value is missing. */
const PRIORITY_STYLE = {
  High: {
    label: 'High impact',
    cls: 'bg-red-50 text-red-700 border-red-200',
  },
  Medium: {
    label: 'Medium impact',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  Low: {
    label: 'Low impact',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
}

const EFFORT_STYLE = {
  High: 'bg-red-50 text-red-700',
  Medium: 'bg-amber-50 text-amber-700',
  Low: 'bg-emerald-50 text-emerald-700',
}

function StateShell({ kind, message, onRetry, loading }) {
  if (kind === 'loading') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-lg bg-gray-200" />
              <div className="h-3 w-32 bg-gray-200 rounded" />
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="h-2.5 bg-gray-100 rounded w-full" />
              <div className="h-2.5 bg-gray-100 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (kind === 'error') {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50/50 p-6 text-center">
        <AlertTriangle className="h-5 w-5 text-red-500 mx-auto mb-2" />
        <p className="text-xs font-bold text-red-700">{message || 'Failed to load recommendations'}</p>
        <button
          onClick={onRetry}
          disabled={loading}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-red-700 hover:text-red-900 disabled:opacity-50 cursor-pointer"
        >
          <RotateCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Retry
        </button>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-6 text-center">
      <Inbox className="h-5 w-5 text-gray-400 mx-auto mb-2" />
      <p className="text-xs font-bold text-gray-600">No recommendations available</p>
      <p className="text-[11px] text-gray-500 mt-0.5">Refresh to regenerate.</p>
    </div>
  )
}

export default function RecommendationsPanel({ data, status, error, onRetry, fallback }) {
  const recommendations = Array.isArray(data?.recommendations) ? data.recommendations : []
  const showShell = status === 'loading' || status === 'error' || (status === 'idle' && !recommendations.length)

  return (
    <div
      className="rounded-[20px] border border-gray-100 bg-white p-5.5 space-y-4"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-bold text-gray-900 tracking-tight leading-snug">
            Recommendations
          </h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
            Strategic actions for this account
          </p>
        </div>
        {fallback && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Offline
          </span>
        )}
      </div>

      {showShell ? (
        <StateShell
          kind={status === 'idle' ? 'empty' : status}
          message={error}
          onRetry={onRetry}
          loading={status === 'loading'}
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {recommendations.map((r, i) => {
              const impact = (r.impact || 'Medium').charAt(0).toUpperCase() + (r.impact || 'Medium').slice(1).toLowerCase()
              const effort = r.effort || 'Medium'
              const pstyle = PRIORITY_STYLE[impact] || PRIORITY_STYLE.Medium
              const estyle = EFFORT_STYLE[effort] || EFFORT_STYLE.Medium
              return (
                <motion.div
                  key={r.id || i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
                  className="rounded-2xl border border-gray-100 bg-white hover:border-violet-200 hover:bg-violet-50/30 transition-all p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-6 w-6 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                        <Lightbulb className="h-3.5 w-3.5 text-violet-600" />
                      </div>
                      <p className="text-[12.5px] font-bold text-gray-900 leading-snug">
                        {r.title}
                      </p>
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${pstyle.cls} shrink-0`}>
                      {pstyle.label}
                    </span>
                  </div>
                  {r.rationale && (
                    <p className="text-[11.5px] text-gray-600 leading-relaxed pl-8">{r.rationale}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2.5 pl-8 flex-wrap">
                    {r.category && (
                      <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {r.category}
                      </span>
                    )}
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${estyle}`}>
                      Effort: {effort}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-[10px] text-gray-500 leading-relaxed font-semibold">
            <p className="flex items-center gap-1.5">
              <ArrowRight className="h-3 w-3 text-violet-500" />
              Tips are generated from your last 25 reels and updated every 24h.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
