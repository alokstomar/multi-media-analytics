import { motion } from 'framer-motion'
import { Sparkles, RefreshCw } from 'lucide-react'

const SUB_SCORES = [
  { key: 'language',   label: 'Language' },
  { key: 'hook',       label: 'Hook' },
  { key: 'flow',       label: 'Flow' },
  { key: 'rhythm',     label: 'Rhythm' },
  { key: 'vocabulary', label: 'Vocabulary' },
  { key: 'retention',  label: 'Retention Pattern' },
]

function scoreColor(score) {
  if (score >= 85) return { text: 'text-emerald-600', bar: 'bg-emerald-500' }
  if (score >= 70) return { text: 'text-violet-600', bar: 'bg-violet-500' }
  if (score >= 50) return { text: 'text-amber-600', bar: 'bg-amber-500' }
  return { text: 'text-red-600', bar: 'bg-red-500' }
}

export default function StyleMatchPanel({ styleMatch, onRescore, isScoring }) {
  const overall = styleMatch?.overall
  const hasScores = overall != null
  const { text, bar } = scoreColor(overall || 0)

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-gray-100 bg-white overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <h3 className="text-[13.5px] font-bold text-gray-900">Creator Style Match</h3>
        </div>
        <button
          onClick={onRescore}
          disabled={!hasScores || isScoring}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10.5px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          title="Re-score current script"
        >
          <RefreshCw className={`h-3 w-3 ${isScoring ? 'animate-spin' : ''}`} />
          Rescore
        </button>
      </div>

      {!hasScores ? (
        <div className="p-8 text-center">
          <p className="text-[12.5px] text-gray-500 font-medium">
            Generate a script to see how closely it matches the creator's voice.
          </p>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {/* Overall score ring */}
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0">
              <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none" stroke="url(#violetGrad)" strokeWidth="3.5"
                  strokeDasharray={`${overall}, 100`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="violetGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-[20px] font-bold ${text}`}>{Math.round(overall)}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-gray-900">
                {overall >= 85 ? 'Strongly matches creator voice' : overall >= 70 ? 'Good match — minor deviations' : overall >= 50 ? 'Partial match — consider regenerating' : 'Weak match — try "More Similar"'}
              </p>
              <p className="text-[11.5px] text-gray-500 mt-0.5 leading-relaxed">
                How closely this script imitates the creator's signature voice, hook style, and rhythm.
              </p>
            </div>
          </div>

          {/* Sub-scores */}
          <div className="space-y-2.5 pt-2 border-t border-gray-100">
            {SUB_SCORES.map((s) => {
              const score = styleMatch?.[s.key]
              if (score == null) return null
              const sc = scoreColor(score)
              return (
                <div key={s.key}>
                  <div className="flex justify-between text-[11.5px] font-bold mb-1">
                    <span className="text-gray-500">{s.label}</span>
                    <span className={sc.text}>{Math.round(score)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={`${sc.bar} h-full rounded-full`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </motion.section>
  )
}
