import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { LOADING_STAGES } from './researchUtils'

// Skeleton during first analysis. Mirrors the shape of the loaded workspace
// (header + hero + sub-scores + claim rows) so layout doesn't shift when
// results arrive.
//
// Below the skeleton, cycles through LOADING_STAGES messages every ~1.5s to
// give the editor a sense of progress. The stages are purely presentational —
// they don't map 1:1 to backend steps.
const STAGE_MS = 1500

export default function ResearchLoadingShell() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setStage((s) => (s + 1) % LOADING_STAGES.length)
    }, STAGE_MS)
    return () => clearInterval(id)
  }, [])

  const message = LOADING_STAGES[stage] || LOADING_STAGES[0]

  return (
    <div className="space-y-3.5">
      {/* Skeleton mirroring loaded layout */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-gray-100 rounded-full" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-1/3 bg-gray-100 rounded" />
            <div className="h-2.5 w-1/2 bg-gray-100 rounded" />
            <div className="h-2.5 w-2/3 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/40 px-3 py-2.5 space-y-2">
              <div className="h-2 w-12 bg-gray-100 rounded" />
              <div className="h-4 w-8 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-2 pt-2 border-t border-gray-100">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/40 px-3 py-2.5">
              <div className="flex justify-between mb-2">
                <div className="h-2.5 w-24 bg-gray-100 rounded" />
                <div className="h-2.5 w-8 bg-gray-100 rounded" />
              </div>
              <div className="h-2 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Staged progress message */}
      <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-3.5 py-2.5 flex items-center gap-2.5">
        <Loader2 className="h-3.5 w-3.5 text-violet-600 animate-spin shrink-0" />
        <div className="min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={stage}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="text-[11.5px] font-semibold text-violet-700 leading-snug"
            >
              {message}
            </motion.p>
          </AnimatePresence>
        </div>
        <span className="text-[10px] font-bold text-violet-500 tabular-nums shrink-0">
          {stage + 1}/{LOADING_STAGES.length}
        </span>
      </div>
    </div>
  )
}
