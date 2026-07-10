import { motion } from 'framer-motion'
import { AlertTriangle, CloudOff } from 'lucide-react'

// Amber banner shown when verification is non-grounded. Two variants:
//   - provider === 'stub-fallback': Tavily was configured but failed mid-run;
//     the engine fell back to AI-only analysis for this report.
//   - otherwise (provider === 'stub' or unset): no grounded provider is
//     configured at all. User needs to wire in Tavily/Bing.
export default function LimitedVerificationBadge({ provider = 'stub' }) {
  const isFallback = provider === 'stub-fallback'

  const title = isFallback
    ? 'Live verification unavailable. Falling back to AI analysis.'
    : 'Limited verification — no live web search configured'

  const body = isFallback
    ? 'Tavily could not be reached for this run. Claims were analyzed by AI only — re-analyze to retry live verification.'
    : 'Claims will be marked unverified. Wire in Tavily or Bing (backend SEARCH_PROVIDER) for grounded fact-checks.'

  const Icon = isFallback ? CloudOff : AlertTriangle

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-start gap-2.5"
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-amber-900 leading-snug">
          {title}
        </p>
        <p className="text-[11px] text-amber-800/80 leading-snug mt-0.5">
          {body}
        </p>
      </div>
    </motion.div>
  )
}
