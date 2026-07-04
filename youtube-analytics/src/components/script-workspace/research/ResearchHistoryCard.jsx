import { motion } from 'framer-motion'
import { History, TrendingUp, TrendingDown, Minus } from 'lucide-react'

function scoreTone(score) {
  if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-100'
  if (score >= 55) return 'text-sky-600 bg-sky-50 border-sky-100'
  if (score >= 30) return 'text-amber-600 bg-amber-50 border-amber-100'
  return 'text-red-600 bg-red-50 border-red-100'
}

function relativeTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

// Compact timeline of research scores across script versions. Backed by
// localStorage (no backend migration) — every time a fresh report arrives,
// the parent calls `appendResearchHistory` with the new entry.
//
// Shows: version number, score badge, delta vs previous, timestamp. The
// latest entry is highlighted. Empty state explains the timeline.
export default function ResearchHistoryCard({ history = [], latestScore = null }) {
  const sorted = [...history].sort((a, b) => {
    if (a.version != null && b.version != null) return b.version - a.version
    return (b.ts || 0) - (a.ts || 0)
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-gray-100 bg-white overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
    >
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <History className="h-4 w-4" />
          </div>
          <h3 className="text-[12.5px] font-bold text-gray-900">Research History</h3>
        </div>
        {sorted.length > 0 && (
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider tabular-nums">
            {sorted.length} snapshot{sorted.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="p-5 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 border border-gray-100 mx-auto mb-2">
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-[11.5px] text-gray-600 font-semibold">Score timeline appears here</p>
          <p className="text-[10.5px] text-gray-400 mt-1 leading-relaxed max-w-[240px] mx-auto">
            As you apply suggestions and re-analyze, every research score is
            tracked here so you can see the script improving over time.
          </p>
        </div>
      ) : (
        <div className="p-3 space-y-1.5 max-h-[280px] overflow-y-auto">
          {sorted.map((entry, i) => {
            const prev = sorted[i + 1]
            const delta = prev ? entry.score - prev.score : null
            const isLatest = i === 0
            const tone = scoreTone(entry.score)

            return (
              <motion.div
                key={`${entry.version}-${entry.ts}-${i}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition ${
                  isLatest ? 'border-violet-200 bg-violet-50/40' : 'border-gray-100 bg-white'
                }`}
              >
                {/* Version label */}
                <div className="min-w-0 w-[68px] shrink-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Version
                  </p>
                  <p className="text-[12px] font-bold text-gray-900 tabular-nums">
                    {entry.version != null ? `v${entry.version}` : '—'}
                  </p>
                </div>

                {/* Score badge */}
                <div className={`inline-flex items-center justify-center rounded-full border px-2 py-1 text-[11px] font-black tabular-nums shrink-0 ${tone}`}>
                  {Math.round(entry.score)}
                </div>

                {/* Delta indicator */}
                <div className="shrink-0 min-w-[44px]">
                  {delta == null ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <Minus className="h-2.5 w-2.5" /> base
                    </span>
                  ) : delta > 0 ? (
                    <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-emerald-700 tabular-nums">
                      <TrendingUp className="h-3 w-3" /> +{delta}
                    </span>
                  ) : delta < 0 ? (
                    <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-red-700 tabular-nums">
                      <TrendingDown className="h-3 w-3" /> {delta}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <Minus className="h-2.5 w-2.5" /> 0
                    </span>
                  )}
                </div>

                {/* Timestamp + latest tag */}
                <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5">
                  <span className="text-[10px] text-gray-400 truncate">
                    {relativeTime(entry.ts)}
                  </span>
                  {isLatest && (
                    <span className="inline-flex items-center rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-black text-violet-700 uppercase tracking-wider shrink-0">
                      Latest
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {latestScore != null && sorted.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/40">
          <p className="text-[10px] text-gray-500 leading-relaxed">
            <span className="font-bold text-gray-700">Tip:</span> apply suggestions and re-analyze
            to grow this timeline. Each snapshot captures the research score at a script version.
          </p>
        </div>
      )}
    </motion.div>
  )
}
