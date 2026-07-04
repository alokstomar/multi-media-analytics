import { motion } from 'framer-motion'
import {
  ShieldCheck, ShieldAlert, ShieldX, Sparkles, FileSearch, ListChecks, FileQuestion,
} from 'lucide-react'
import {
  deriveRiskLevel, deriveRecommendation, deriveMetrics, derivePublishStatus,
} from './researchUtils'

// Map risk tint → lucide icon + tailwind classes. All tints come from the
// existing design system (emerald/amber/red) — no new colors introduced.
const RISK_VIEW = {
  emerald: {
    Icon: ShieldCheck,
    ringFrom: '#10b981',
    ringTo:   '#34d399',
    iconWrap: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    title: 'text-emerald-700',
    accent: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    glow: '0 12px 40px -12px rgba(16,185,129,0.35)',
  },
  amber: {
    Icon: ShieldAlert,
    ringFrom: '#f59e0b',
    ringTo:   '#fbbf24',
    iconWrap: 'bg-amber-50 text-amber-600 border-amber-200',
    title: 'text-amber-700',
    accent: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    glow: '0 12px 40px -12px rgba(245,158,11,0.35)',
  },
  red: {
    Icon: ShieldX,
    ringFrom: '#ef4444',
    ringTo:   '#f87171',
    iconWrap: 'bg-red-50 text-red-600 border-red-200',
    title: 'text-red-700',
    accent: 'bg-red-500',
    chip: 'bg-red-50 text-red-700 border-red-200',
    glow: '0 12px 40px -12px rgba(239,68,68,0.35)',
  },
}

function StatTile({ Icon, label, value, sub, tint = 'gray' }) {
  const tintMap = {
    gray:    { icon: 'bg-gray-50 text-gray-600',                  value: 'text-gray-900' },
    emerald: { icon: 'bg-emerald-50 text-emerald-600',             value: 'text-emerald-700' },
    amber:   { icon: 'bg-amber-50 text-amber-600',                 value: 'text-amber-700' },
    red:     { icon: 'bg-red-50 text-red-600',                     value: 'text-red-700' },
    sky:     { icon: 'bg-sky-50 text-sky-600',                     value: 'text-sky-700' },
    violet:  { icon: 'bg-violet-50 text-violet-600',               value: 'text-violet-700' },
  }
  const t = tintMap[tint] || tintMap.gray
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <div className={`flex h-5 w-5 items-center justify-center rounded-md ${t.icon}`}>
          <Icon className="h-3 w-3" />
        </div>
        <p className="text-[9.5px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-[18px] font-bold leading-none tabular-nums ${t.value}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{sub}</p>}
    </div>
  )
}

// ── Score Ring ────────────────────────────────────────────────────────────
// Large circular SVG. Animates the dash-offset when score changes. Tinted
// by the current risk level (emerald/amber/red). In stub mode we still show
// the score but desaturate slightly to communicate "AI-only verification".
function ScoreRing({ score, view, size = 144 }) {
  const stroke = 7
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const offset = circ - (Math.max(0, Math.min(100, score)) / 100) * circ
  const gid = `exec-ring-${view.ringFrom.replace('#', '')}`

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#f3f4f6" strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={`url(#${gid})`} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={view.ringFrom} />
            <stop offset="100%" stopColor={view.ringTo} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={Math.round(score)}
          initial={{ opacity: 0, scale: 0.85, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="text-[44px] font-black tabular-nums text-gray-900 leading-none"
        >
          {Math.round(score)}
        </motion.span>
        <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest mt-1">
          / 100
        </span>
      </div>
    </div>
  )
}

// Visual centerpiece of the Research Workspace. The score is the dominant
// element — large ring, large risk badge, single-line explanation directly
// below. Editors should be able to answer "is this publishable?" at a glance.
//
// Layout (desktop): score hero centered-left, stat tiles to the right.
// Mobile: hero stacks on top, tiles below.
export default function ExecutiveSummaryCard({ report, scoreRing = null }) {
  const risk = deriveRiskLevel(report)
  const metrics = deriveMetrics(report)
  const recommendation = deriveRecommendation(report)
  const publishStatus = derivePublishStatus(report)
  const view = RISK_VIEW[risk.tint] || RISK_VIEW.amber
  const Icon = view.Icon
  const overallScore = report?.report?.researchScore?.overall ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-gray-100 bg-white overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px -10px rgba(0,0,0,0.08)' }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
        {/* HERO COLUMN — dominant score + risk + explanation */}
        <div className="relative p-6 sm:p-7 border-b lg:border-b-0 lg:border-r border-gray-100 bg-gradient-to-br from-gray-50/60 via-white to-white">
          <div className="flex items-center gap-1.5 mb-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.18em]">Research Score</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
            {scoreRing || <ScoreRing score={overallScore} view={view} />}

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${view.chip}`}
                style={{ boxShadow: view.glow }}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[12.5px] font-black uppercase tracking-wider">{risk.label}</span>
              </motion.div>

              <p className="text-[13.5px] sm:text-[14px] text-gray-700 font-medium leading-snug mt-3 max-w-md">
                {recommendation}
              </p>

              <div className="flex items-center gap-1.5 mt-3 justify-center sm:justify-start">
                <Sparkles className="h-3 w-3 text-violet-500 shrink-0" />
                <p className="text-[10.5px] text-gray-500 font-semibold uppercase tracking-wider">
                  {publishStatus.label}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* STAT TILES COLUMN */}
        <div className="p-4 sm:p-5 lg:p-6">
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile
              Icon={ShieldCheck}
              label="Verified"
              value={`${metrics.verified} / ${metrics.totalClaims}`}
              sub="claims with sources"
              tint={metrics.verified > 0 ? 'emerald' : 'gray'}
            />
            <StatTile
              Icon={FileQuestion}
              label="Needs Review"
              value={metrics.needsReview}
              sub="weak / contradicted"
              tint={metrics.needsReview > 0 ? 'amber' : 'gray'}
            />
            <StatTile
              Icon={ListChecks}
              label="Suggestions"
              value={report?.report?.suggestions?.length || 0}
              sub="actionable fixes"
              tint="violet"
            />
            <StatTile
              Icon={FileSearch}
              label="Missing Context"
              value={report?.report?.missingContext?.length || 0}
              sub="advisory additions"
              tint="sky"
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
