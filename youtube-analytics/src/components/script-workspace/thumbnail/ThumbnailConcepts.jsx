import { motion } from 'framer-motion'
import { Lightbulb, TrendingUp, Target, BarChart3 } from 'lucide-react'
import { ctrBand, scoreColor, tintClass } from './thumbnailUtils'

// Thumbnail Concepts — the AI-generated list of 3-5 thumbnail concepts.
// Each concept is read-only; to change them, the user clicks "Regenerate".
//
// concept shape:
//   { id, title, explanation, audienceReaction, whyItFits,
//     predictedCTR (0-20%), similarity (0-100), confidence (0-100) }

export default function ThumbnailConcepts({ concepts }) {
  if (!Array.isArray(concepts) || concepts.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-gray-100 bg-white p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600">
            <Lightbulb className="h-3.5 w-3.5" />
          </div>
          <h4 className="text-[12px] font-bold text-gray-900">Concepts</h4>
        </div>
        <span className="text-[10.5px] font-semibold text-gray-400 tabular-nums">
          {concepts.length} designed
        </span>
      </div>

      <div className="space-y-2">
        {concepts.map((c, idx) => (
          <ConceptRow key={c.id || `concept-${idx}`} concept={c} index={idx} />
        ))}
      </div>
    </motion.div>
  )
}

function ConceptRow({ concept, index }) {
  const ctrBandMeta = ctrBand(concept.predictedCTR)
  const simScore = scoreColor(concept.similarity)
  const confScore = scoreColor(concept.confidence)

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.2) }}
      className="rounded-lg border border-gray-100 bg-white p-3 hover:border-violet-200 hover:bg-violet-50/30 transition"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-start gap-1.5 min-w-0">
          <span className="inline-flex items-center justify-center rounded-md bg-violet-50 text-violet-700 text-[10px] font-bold w-5 h-5 shrink-0 mt-0.5">
            {index + 1}
          </span>
          <h5 className="text-[12.5px] font-bold text-gray-900 leading-tight">{concept.title}</h5>
        </div>
        {ctrBandMeta && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider shrink-0 ${tintClass(ctrBandMeta.tint)}`}>
            <TrendingUp className="h-2.5 w-2.5" />
            {ctrBandMeta.label}
          </span>
        )}
      </div>

      {concept.explanation && (
        <p className="text-[11.5px] text-gray-700 leading-relaxed pl-6">{concept.explanation}</p>
      )}

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2 mt-2.5 pl-6">
        <Metric
          icon={TrendingUp}
          label="Pred. CTR"
          value={concept.predictedCTR != null ? `${Number(concept.predictedCTR).toFixed(1)}%` : '—'}
        />
        <Metric
          icon={Target}
          label="DNA Match"
          value={concept.similarity != null ? Math.round(concept.similarity) : '—'}
          tint={simScore.text}
        />
        <Metric
          icon={BarChart3}
          label="Confidence"
          value={concept.confidence != null ? Math.round(concept.confidence) : '—'}
          tint={confScore.text}
        />
      </div>

      {/* Why it fits + audience reaction — advisory */}
      {(concept.whyItFits || concept.audienceReaction) && (
        <div className="mt-2.5 pl-6 space-y-1">
          {concept.whyItFits && (
            <div className="text-[10.5px] text-gray-600 leading-relaxed">
              <span className="font-bold text-violet-600">Why it fits:</span>{' '}
              <span>{concept.whyItFits}</span>
            </div>
          )}
          {concept.audienceReaction && (
            <div className="text-[10.5px] text-gray-600 leading-relaxed">
              <span className="font-bold text-amber-600">Audience reaction:</span>{' '}
              <span>{concept.audienceReaction}</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

function Metric({ icon: Icon, label, value, tint }) {
  return (
    <div className="rounded-md bg-gray-50 border border-gray-100 px-2 py-1">
      <div className="flex items-center gap-1">
        <Icon className="h-2.5 w-2.5 text-gray-400" />
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-[12px] font-bold tabular-nums mt-0.5 ${tint || 'text-gray-700'}`}>{value}</p>
    </div>
  )
}
