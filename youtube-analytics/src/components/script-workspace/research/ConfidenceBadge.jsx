import { Check, AlertTriangle, X, HelpCircle } from 'lucide-react'
import { verdictBadge } from './researchUtils'

// Verdict → icon mapping (lucide components referenced directly so they
// tree-shake properly). Color tint comes from verdictBadge() and uses only
// the existing design-system palette (emerald/amber/orange/red/gray).
const ICONS = {
  'check': Check,
  'alert-triangle': AlertTriangle,
  'x': X,
}

const TINT_CLASSES = {
  emerald: { wrap: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  amber:   { wrap: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-500' },
  orange:  { wrap: 'bg-orange-50 text-orange-700 border-orange-200',    dot: 'bg-orange-500' },
  red:     { wrap: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-500' },
  gray:    { wrap: 'bg-gray-100 text-gray-600 border-gray-200',         dot: 'bg-gray-400' },
}

const SIZE_CLASSES = {
  sm: { wrap: 'px-1.5 py-0.5 text-[9px]', icon: 'h-2.5 w-2.5' },
  md: { wrap: 'px-2 py-0.5 text-[10px]',  icon: 'h-3 w-3' },
  lg: { wrap: 'px-2.5 py-1 text-[10.5px]', icon: 'h-3.5 w-3.5' },
}

// Verdict-driven confidence badge. The verdict (verified/needs-citation/
// weak/false/unverified) chooses the icon + label + color; the confidence
// percentage is rendered alongside.
//
// Sizes:
//   sm — compact inline pill (used in claim list rows)
//   md — default (used in claim cards)
//   lg — emphasized (used in detail panel header)
export default function ConfidenceBadge({ verdict, confidence = 0, size = 'md', showLabel = true, showPercent = true }) {
  const badge = verdictBadge(verdict)
  const tint = TINT_CLASSES[badge.tint] || TINT_CLASSES.gray
  const sz = SIZE_CLASSES[size] || SIZE_CLASSES.md
  const Icon = ICONS[badge.icon] || HelpCircle
  const c = Math.round(Number(confidence) || 0)

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wider ${tint.wrap} ${sz.wrap}`}>
      <Icon className={sz.icon} />
      {showLabel && <span>{badge.short}</span>}
      {showPercent && (
        <span className="opacity-80 tabular-nums">{c}%</span>
      )}
    </span>
  )
}
