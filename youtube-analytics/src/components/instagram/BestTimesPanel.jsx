import { motion } from 'framer-motion'
import { Clock, Calendar, TrendingUp, AlertTriangle, Inbox } from 'lucide-react'

/* Map engagement label → color. Backend returns Very High/High/Medium/Low. */
const ENG_COLOR = {
  'Very High': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  High: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  Medium: 'text-amber-700 bg-amber-50 border-amber-200',
  Low: 'text-red-700 bg-red-50 border-red-200',
  Unknown: 'text-gray-600 bg-gray-50 border-gray-200',
}

function Shell({ kind, message }) {
  if (kind === 'loading') {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }
  if (kind === 'error') {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4 text-center">
        <AlertTriangle className="h-4 w-4 text-red-500 mx-auto mb-1.5" />
        <p className="text-xs font-bold text-red-700">{message || 'Failed to load best times'}</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-center">
      <Inbox className="h-4 w-4 text-gray-400 mx-auto mb-1" />
      <p className="text-xs font-bold text-gray-600">No posting-time data yet</p>
    </div>
  )
}

export default function BestTimesPanel({ data, status, error, fallback }) {
  const slots = Array.isArray(data?.bestSlots) ? data.bestSlots : []
  const showShell = status === 'loading' || status === 'error' || (status === 'idle' && !slots.length)

  return (
    <div
      className="rounded-[20px] border border-gray-100 bg-white p-5.5 space-y-4"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Clock className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-bold text-gray-900 tracking-tight leading-snug">
            Best Posting Times
          </h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
            When your reels perform best
          </p>
        </div>
        {fallback && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Estimated
          </span>
        )}
      </div>

      {showShell ? (
        <Shell kind={status === 'idle' ? 'empty' : status} message={error} />
      ) : (
        <div className="space-y-2.5">
          <div className="space-y-2">
            {slots.map((slot, i) => {
              const isTop = i === 0
              const engLabel = slot.avgEngagement || 'Unknown'
              const engStyle = ENG_COLOR[engLabel] || ENG_COLOR.Unknown
              const confidence = typeof slot.confidence === 'number' ? slot.confidence : 0
              return (
                <motion.div
                  key={`${slot.day}-${slot.hour}-${i}`}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.06, 0.3) }}
                  className={`relative flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isTop
                      ? 'border-violet-300 bg-gradient-to-r from-violet-50 to-pink-50 shadow-sm'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg font-bold text-[13px] tabular-nums ${
                      isTop ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      #{i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-gray-900 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        {slot.day}
                        <span className="text-gray-400">·</span>
                        <span className="tabular-nums">{slot.label}</span>
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Sample size: {slot.sampleCount || 0} reel{slot.sampleCount === 1 ? '' : 's'} · {confidence}% confidence
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${engStyle}`}>
                    {engLabel}
                  </span>
                </motion.div>
              )
            })}
          </div>
          {slots[0] && (
            <div className="rounded-xl bg-violet-50 border border-violet-100 p-3 text-[11px] text-violet-900 leading-relaxed font-semibold flex items-start gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-violet-600 mt-0.5 shrink-0" />
              <span>
                Top slot: <strong>{slots[0].day} at {slots[0].label}</strong>. Schedule your next reel here for maximum reach.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
