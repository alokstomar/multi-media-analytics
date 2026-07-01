import { motion, AnimatePresence } from 'framer-motion'
import { Users, Target, AlertTriangle, Inbox } from 'lucide-react'

const LEVEL_COLOR = {
  High: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-gray-50 text-gray-600 border-gray-200',
}

function Shell({ kind, message }) {
  if (kind === 'loading') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 animate-pulse">
            <div className="h-3 w-40 bg-gray-200 rounded" />
            <div className="mt-2 space-y-1.5">
              <div className="h-2.5 bg-gray-100 rounded w-full" />
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
        <p className="text-xs font-bold text-red-700">{message || 'Failed to load competitor insights'}</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-center">
      <Inbox className="h-4 w-4 text-gray-400 mx-auto mb-1" />
      <p className="text-xs font-bold text-gray-600">No competitor data available</p>
    </div>
  )
}

export default function CompetitorInsightsPanel({ data, status, error, fallback }) {
  const opportunities = Array.isArray(data?.opportunities) ? data.opportunities : []
  const competitors = Array.isArray(data?.competitors) ? data.competitors : []
  const showShell = status === 'loading' || status === 'error' || (status === 'idle' && !opportunities.length)

  return (
    <div
      className="rounded-[20px] border border-gray-100 bg-white p-5.5 space-y-4"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
          <Users className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-bold text-gray-900 tracking-tight leading-snug">
            Competitor Insights
          </h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
            Opportunities from your workspace
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
          {/* Competitor summary chips */}
          {competitors.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mr-1">
                Tracking:
              </span>
              {competitors.slice(0, 4).map((c) => (
                <span
                  key={c.accountId}
                  className="text-[10px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full"
                  title={`${c.followers || 0} followers`}
                >
                  @{c.username}
                </span>
              ))}
              {competitors.length > 4 && (
                <span className="text-[10px] font-bold text-gray-500">+{competitors.length - 4} more</span>
              )}
            </div>
          )}

          <AnimatePresence initial={false}>
            {opportunities.map((o, i) => {
              const level = o.opportunityLevel || 'Medium'
              const lstyle = LEVEL_COLOR[level] || LEVEL_COLOR.Medium
              return (
                <motion.div
                  key={o.id || i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
                  className="rounded-2xl border border-gray-100 bg-white p-4 hover:border-orange-200 hover:bg-orange-50/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-[12.5px] font-bold text-gray-900 leading-snug flex-1 flex items-start gap-1.5">
                      <Target className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                      <span>{o.title}</span>
                    </p>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${lstyle} shrink-0`}>
                      {level}
                    </span>
                  </div>
                  {o.reason && (
                    <p className="text-[11.5px] text-gray-600 leading-relaxed pl-5">{o.reason}</p>
                  )}
                  {o.estimatedSearchVolume && (
                    <p className="text-[10px] text-gray-500 mt-1.5 pl-5">
                      Estimated reach: <strong className="text-gray-700">{o.estimatedSearchVolume}</strong>
                    </p>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
