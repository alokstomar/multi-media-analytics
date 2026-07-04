import { motion } from 'framer-motion'
import {
  CheckCircle2, XCircle, Hash, Calendar, FileText, MessageSquare,
} from 'lucide-react'
import { deriveMetrics } from './researchUtils'

// Pure informational counters — every number is derived from existing
// claim.type / claim.verdict fields. No new classification logic.
//
// Renders as a horizontal strip of small stat chips. Each chip is icon +
// count + label. Wraps on small screens.
function MetricChip({ Icon, count, label, tint = 'gray' }) {
  const tintMap = {
    gray:    'text-gray-700 bg-gray-50 border-gray-100',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    red:     'text-red-700 bg-red-50 border-red-100',
    amber:   'text-amber-700 bg-amber-50 border-amber-100',
    sky:     'text-sky-700 bg-sky-50 border-sky-100',
    violet:  'text-violet-700 bg-violet-50 border-violet-100',
  }
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 ${tintMap[tint] || tintMap.gray}`}>
      <Icon className="h-3 w-3 opacity-80" />
      <span className="text-[11.5px] font-bold tabular-nums">{count}</span>
      <span className="text-[10.5px] font-semibold opacity-70">{label}</span>
    </div>
  )
}

export default function MetricsStrip({ report }) {
  const m = deriveMetrics(report)

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-gray-100 bg-white px-3 py-2.5"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Editorial Metrics</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <MetricChip Icon={CheckCircle2} count={m.verified}    label="Verified"    tint={m.verified > 0 ? 'emerald' : 'gray'} />
        <MetricChip Icon={XCircle}      count={m.unverified}  label="Unverified"  tint={m.unverified > 0 ? 'red' : 'gray'} />
        <MetricChip Icon={Hash}         count={m.statistics}  label="Statistics"  tint={m.statistics > 0 ? 'amber' : 'gray'} />
        <MetricChip Icon={Calendar}     count={m.dates}       label="Dates"       tint={m.dates > 0 ? 'sky' : 'gray'} />
        <MetricChip Icon={FileText}     count={m.facts}       label="Facts"       tint={m.facts > 0 ? 'violet' : 'gray'} />
        {m.otherClaims > 0 && (
          <MetricChip Icon={MessageSquare} count={m.otherClaims} label="Opinions" tint="gray" />
        )}
      </div>
    </motion.div>
  )
}
