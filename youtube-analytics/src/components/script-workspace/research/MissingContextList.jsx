import { motion } from 'framer-motion'
import { Lightbulb, ArrowRight, Sparkles } from 'lucide-react'

const PRIORITY_STYLES = {
  high:   {
    dot: 'bg-red-500',
    chip: 'bg-red-50 text-red-700 border-red-200',
    accent: 'border-l-red-400',
    label: 'HIGH',
    rank: 0,
  },
  medium: {
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    accent: 'border-l-amber-400',
    label: 'MEDIUM',
    rank: 1,
  },
  low:    {
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accent: 'border-l-emerald-400',
    label: 'LOW',
    rank: 2,
  },
}

// Sort missing-context items by priority (high → medium → low), preserve
// original order within a priority tier.
function sortByPriority(items) {
  return [...items].sort((a, b) => {
    const ra = PRIORITY_STYLES[a.priority]?.rank ?? 99
    const rb = PRIORITY_STYLES[b.priority]?.rank ?? 99
    return ra - rb
  })
}

// Advisory cards for "what's missing from the script". Each card surfaces:
//   - Priority badge (HIGH / MEDIUM / LOW) as a strong visual signal
//   - Topic as the title
//   - Reason explaining why it matters
//   - Suggested addition in a soft callout
//
// No Apply button — these are advisory. The editor adds context manually.
export default function MissingContextList({ items = [] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-4 text-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mx-auto mb-1.5">
          <Sparkles className="h-4 w-4" />
        </div>
        <p className="text-[12px] text-gray-700 font-semibold">Nothing critical missing.</p>
        <p className="text-[11px] text-gray-400 mt-0.5">No advisory additions — script covers the important bases.</p>
      </div>
    )
  }

  const sorted = sortByPriority(items)

  return (
    <div className="space-y-2">
      {sorted.map((item, i) => {
        const priority = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium
        return (
          <motion.div
            key={item.topic + i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
            className={`rounded-xl border border-gray-100 border-l-2 ${priority.accent} bg-white overflow-hidden`}
          >
            {/* Header — topic + priority badge */}
            <div className="flex items-start gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50/40">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Lightbulb className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-bold text-gray-900 leading-snug">{item.topic}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider shrink-0 ${priority.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} />
                {priority.label}
              </span>
            </div>

            {/* Body — reason + suggested addition */}
            <div className="px-3 py-2.5 space-y-2">
              {item.why && (
                <div>
                  <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Reason</p>
                  <p className="text-[11.5px] text-gray-700 leading-relaxed">{item.why}</p>
                </div>
              )}
              {item.suggestedAddition && (
                <div className="rounded-lg bg-gradient-to-br from-violet-50/60 to-sky-50/40 border border-violet-100 px-2.5 py-2">
                  <div className="flex items-center gap-1 mb-0.5">
                    <ArrowRight className="h-3 w-3 text-violet-600" />
                    <p className="text-[9.5px] font-bold text-violet-700 uppercase tracking-wider">Suggested Addition</p>
                  </div>
                  <p className="text-[11.5px] text-gray-800 italic leading-snug">{item.suggestedAddition}</p>
                </div>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
