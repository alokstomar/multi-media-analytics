import { motion } from 'framer-motion'
import {
  CheckCircle2, AlertCircle, Clock, XCircle, TrendingUp, Wrench,
} from 'lucide-react'
import {
  derivePublishStatus, deriveRemainingFixes, PUBLISH_STATUS,
} from './researchUtils'

const STATUS_VIEW = {
  NOT_READY:  { Icon: XCircle,      tone: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    bar: 'bg-red-500' },
  NEEDS_WORK: { Icon: Wrench,       tone: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  bar: 'bg-amber-500' },
  ALMOST:     { Icon: Clock,        tone: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-200',    bar: 'bg-sky-500' },
  READY:      { Icon: CheckCircle2, tone: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200',bar: 'bg-emerald-500' },
}

// Stages shown left → right as the script improves. The current stage is
// highlighted; later stages are dimmed to show "where you're going".
const STAGE_ORDER = [PUBLISH_STATUS.NOT_READY, PUBLISH_STATUS.NEEDS_WORK, PUBLISH_STATUS.ALMOST, PUBLISH_STATUS.READY]

// Replaces the old progress bar. Surfaces publication readiness as a
// first-class concept with: status (Not Ready → Needs Work → Almost Ready →
// Ready to Publish), progress, and estimated remaining fixes.
//
// Score → status mapping:
//   < 30 → NOT_READY
//   < 55 → NEEDS_WORK
//   < 80 → ALMOST
//   >= 80 → READY
//
// All thresholds are pure UI — no backend logic changes.
export default function PublishReadinessCard({ report }) {
  const status = derivePublishStatus(report)
  const view = STATUS_VIEW[status.key]
  const Icon = view.Icon
  const score = report?.report?.researchScore?.overall ?? 0
  const remaining = deriveRemainingFixes(report)

  // Find current stage index for the stepper
  const currentIndex = STAGE_ORDER.findIndex((s) => s.key === status.key)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-gray-100 bg-white overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
    >
      <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <TrendingUp className="h-4 w-4" />
          </div>
          <h3 className="text-[12.5px] font-bold text-gray-900">Publish Readiness</h3>
        </div>
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${view.bg} ${view.border}`}>
          <Icon className={`h-3 w-3 ${view.tone}`} />
          <span className={`text-[10.5px] font-black uppercase tracking-wider ${view.tone}`}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Stage stepper — Not Ready → Needs Work → Almost Ready → Ready */}
        <div className="flex items-center gap-1">
          {STAGE_ORDER.map((s, i) => {
            const isCurrent = i === currentIndex
            const isPast = i < currentIndex
            const stageView = STATUS_VIEW[s.key]
            const StageIcon = stageView.Icon
            return (
              <div key={s.key} className="flex items-center gap-1 flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
                  <motion.div
                    initial={false}
                    animate={{
                      opacity: isCurrent || isPast ? 1 : 0.4,
                      scale: isCurrent ? 1.1 : 1,
                    }}
                    transition={{ duration: 0.25 }}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${isCurrent ? stageView.bg + ' ' + stageView.border : isPast ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-200'}`}
                  >
                    <StageIcon className={`h-3.5 w-3.5 ${isCurrent ? stageView.tone : isPast ? 'text-gray-500' : 'text-gray-300'}`} />
                  </motion.div>
                  <span className={`text-[8.5px] font-bold uppercase tracking-wider truncate text-center ${isCurrent ? stageView.tone : 'text-gray-400'}`}>
                    {s.label.split(' ')[0]}
                  </span>
                </div>
                {i < STAGE_ORDER.length - 1 && (
                  <div className="h-[2px] flex-1 bg-gray-100 rounded-full overflow-hidden min-w-[8px]">
                    <motion.div
                      initial={false}
                      animate={{ width: isPast ? '100%' : '0%' }}
                      transition={{ duration: 0.4 }}
                      className={`h-full ${stageView.bar}`}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Status explanation + remaining fixes */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/40 px-3.5 py-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className={`h-3.5 w-3.5 ${view.tone} mt-0.5 shrink-0`} />
            <p className="text-[11.5px] text-gray-700 leading-snug flex-1">
              {status.hint}
            </p>
          </div>
          {remaining > 0 ? (
            <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
              <Wrench className="h-3 w-3 text-amber-600" />
              <p className="text-[11.5px] text-gray-700 font-medium">
                <span className="font-bold tabular-nums">{remaining}</span> fix{remaining === 1 ? '' : 'es'} remaining
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              <p className="text-[11.5px] text-emerald-700 font-medium">No outstanding fixes — ready to ship.</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">Progress</p>
            <p className={`text-[11px] font-bold tabular-nums ${view.tone}`}>{Math.round(score)}%</p>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className={`h-full rounded-full ${view.bar}`}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
