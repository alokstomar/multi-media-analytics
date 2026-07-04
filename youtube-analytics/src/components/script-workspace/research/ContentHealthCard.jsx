import { motion } from 'framer-motion'
import {
  Sparkles, FlaskConical, Rocket, Image as ImageIcon, TrendingUp,
} from 'lucide-react'

function scoreTone(score) {
  if (score == null) return { text: 'text-gray-400', bar: 'bg-gray-200' }
  if (score >= 80) return { text: 'text-emerald-600', bar: 'bg-emerald-500' }
  if (score >= 55) return { text: 'text-sky-600', bar: 'bg-sky-500' }
  if (score >= 30) return { text: 'text-amber-600', bar: 'bg-amber-500' }
  return { text: 'text-red-600', bar: 'bg-red-500' }
}

// Compact "content health" snapshot for the editor's right column. Pulls
// together signals from multiple modules — Creator Style, Research, Publish
// Readiness, Thumbnail, Estimated Performance — so the editor can see at a
// glance how the content is shaping up overall.
//
// Inputs are passed via props; the card itself does NO data fetching. The
// parent decides what to feed in.
//
// Thumbnail Potential and Estimated Performance are shown as "—" when no
// signal is available (Phase 2.5 doesn't wire those modules into this page).
function MetricRow({ Icon, label, value, score, tint, hint }) {
  const tone = scoreTone(score)
  const displayScore = score != null ? Math.round(score) : null
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-gray-50/60 transition">
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${tint?.wrap || 'bg-gray-50 text-gray-500'}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider truncate">
            {label}
          </p>
          <p className={`text-[12.5px] font-black tabular-nums ${tone.text}`}>
            {value != null ? value : '—'}
          </p>
        </div>
        {score != null && (
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${displayScore}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`h-full rounded-full ${tone.bar}`}
            />
          </div>
        )}
        {hint && score == null && (
          <p className="text-[9.5px] text-gray-400 mt-0.5 truncate">{hint}</p>
        )}
      </div>
    </div>
  )
}

export default function ContentHealthCard({
  styleMatchScore = null,
  researchScore = null,
  publishScore = null,
  thumbnailScore = null,
  estimatedReach = null,
}) {
  // The publish score doubles as the readiness signal — when missing, derive
  // from the research score so the card always shows something useful.
  const effectivePublish = publishScore != null ? publishScore : researchScore

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-gray-100 bg-white overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
    >
      <div className="px-4 sm:px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-violet-50/60 to-sky-50/40">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-violet-100 text-violet-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <h3 className="text-[13px] font-bold text-gray-900">Content Health</h3>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-auto">
            Snapshot
          </span>
        </div>
      </div>

      <div className="p-2 space-y-0.5">
        <MetricRow
          Icon={Sparkles}
          label="Creator Style"
          score={styleMatchScore}
          value={styleMatchScore != null ? `${Math.round(styleMatchScore)}%` : null}
          tint={{ wrap: 'bg-violet-50 text-violet-600' }}
          hint="Generate to score"
        />
        <MetricRow
          Icon={FlaskConical}
          label="Research Quality"
          score={researchScore}
          value={researchScore != null ? `${Math.round(researchScore)}%` : null}
          tint={{ wrap: 'bg-sky-50 text-sky-600' }}
          hint="Run research"
        />
        <MetricRow
          Icon={Rocket}
          label="Publishing"
          score={effectivePublish}
          value={effectivePublish != null ? `${Math.round(effectivePublish)}%` : null}
          tint={{ wrap: 'bg-emerald-50 text-emerald-600' }}
          hint="Derived from research"
        />
        <MetricRow
          Icon={ImageIcon}
          label="Thumbnail"
          score={thumbnailScore}
          value={thumbnailScore != null ? `${Math.round(thumbnailScore)}%` : null}
          tint={{ wrap: 'bg-amber-50 text-amber-600' }}
          hint="Not analyzed yet"
        />
        <MetricRow
          Icon={TrendingUp}
          label="Estimated Reach"
          score={null}
          value={estimatedReach != null ? estimatedReach : null}
          tint={{ wrap: 'bg-rose-50 text-rose-600' }}
          hint="Performance forecast coming"
        />
      </div>
    </motion.section>
  )
}
