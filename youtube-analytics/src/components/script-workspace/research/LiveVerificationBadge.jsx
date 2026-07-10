import { motion } from 'framer-motion'
import { ShieldCheck, Globe } from 'lucide-react'

// Positive emerald banner shown when a grounded search provider (Tavily)
// is active and the last run did not degrade. Mirrors the shape of
// LimitedVerificationBadge so ResearchWorkspace can swap between them.
export default function LiveVerificationBadge({ provider = 'tavily' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 flex items-start gap-2.5"
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
        <ShieldCheck className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-emerald-900 leading-snug flex items-center gap-1.5">
          Live web verification enabled
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-700 uppercase tracking-wider">
            <Globe className="h-2.5 w-2.5" />
            {provider}
          </span>
        </p>
        <p className="text-[11px] text-emerald-800/80 leading-snug mt-0.5">
          Research is grounded using Tavily. Claims are verified against live web sources.
        </p>
      </div>
    </motion.div>
  )
}
