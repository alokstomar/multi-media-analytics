import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

// Amber banner shown when the active search provider is non-grounded (stub).
// Tells the user the AI can still extract & suggest, but nothing is
// cross-checked against live web sources.
export default function LimitedVerificationBadge({ provider = 'stub' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-start gap-2.5"
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-amber-900 leading-snug">
          Limited verification — no live web search configured
        </p>
        <p className="text-[11px] text-amber-800/80 leading-snug mt-0.5">
          Claims will be marked <span className="font-semibold">unverified</span>. Wire in Tavily or Bing
          (backend <code className="font-mono">SEARCH_PROVIDER</code>) for grounded fact-checks.
          {provider ? ` Active provider: ${provider}.` : ''}
        </p>
      </div>
    </motion.div>
  )
}
