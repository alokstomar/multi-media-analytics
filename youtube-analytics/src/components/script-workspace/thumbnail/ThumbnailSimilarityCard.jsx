import { motion } from 'framer-motion'
import { RefreshCw, Loader2, Layers } from 'lucide-react'
import {
  SIMILARITY_SUB_SCORES, scoreColor, similarityVerdict,
} from './thumbnailUtils'

// Thumbnail Similarity Card — the score ring + 9 sub-scores showing how closely
// the current strategy (concepts + prompt) matches the creator's Thumbnail DNA.
// Rescore button fires a cheap AI pass that recomputes similarity only.
//
// similarity shape:
//   { overall, colors, typography, layout, composition, emotion,
//     branding, textStyle, visualIdentity }

export default function ThumbnailSimilarityCard({ similarity, onRescore, isRescoring }) {
  const overall = similarity?.overall
  const hasScores = overall != null
  const { text, bar } = scoreColor(overall || 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-gray-100 bg-white p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-50 text-violet-600">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <h4 className="text-[12px] font-bold text-gray-900">DNA Similarity</h4>
        </div>
        <button
          onClick={onRescore}
          disabled={!hasScores || isRescoring}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10.5px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          title="Re-score similarity against DNA"
        >
          {isRescoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Rescore
        </button>
      </div>

      {!hasScores ? (
        <div className="p-4 text-center">
          <p className="text-[11.5px] text-gray-500">
            Generate a strategy to see how closely it matches your visual DNA.
          </p>
        </div>
      ) : (
        <>
          {/* Overall score ring + verdict */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative h-20 w-20 shrink-0">
              <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f3f4f6" strokeWidth="3.5" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none" stroke="url(#thumbVioletGrad)" strokeWidth="3.5"
                  strokeDasharray={`${overall}, 100`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="thumbVioletGrad" x1="0" y1="0" x2="1" y2="1">
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
              <p className="text-[12.5px] font-bold text-gray-900 leading-tight">
                {similarityVerdict(overall)}
              </p>
              <p className="text-[10.5px] text-gray-500 mt-1 leading-relaxed">
                How closely the strategy matches your established thumbnail style.
              </p>
            </div>
          </div>

          {/* Sub-scores */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            {SIMILARITY_SUB_SCORES.map((s) => {
              const score = similarity?.[s.key]
              if (score == null) return null
              const sc = scoreColor(score)
              return (
                <div key={s.key}>
                  <div className="flex justify-between text-[11px] font-bold mb-1">
                    <span className="text-gray-500">{s.label}</span>
                    <span className={sc.text}>{Math.round(score)}</span>
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
        </>
      )}
    </motion.div>
  )
}
