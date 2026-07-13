import { motion } from 'framer-motion'
import { History } from 'lucide-react'

// Thumbnail History Strip — minimal inline version indicator.
// Shows: cursor position + total versions, with the source of the current
// version (ai-initial / ai-regen / user-edit / similarity-rescore) as a badge.
// Not interactive — undo/redo buttons live in the parent.

const SOURCE_LABELS = {
  'ai-initial':       { label: 'Initial',   tint: 'bg-violet-50 text-violet-700 border-violet-200' },
  'ai-regen':         { label: 'Regen',     tint: 'bg-violet-50 text-violet-700 border-violet-200' },
  'user-edit':        { label: 'Edited',    tint: 'bg-sky-50 text-sky-700 border-sky-200' },
  'similarity-rescore': { label: 'Rescored', tint: 'bg-amber-50 text-amber-700 border-amber-200' },
}

export default function ThumbnailHistoryStrip({ strategy }) {
  const versions = strategy?.versions || []
  const cursor = strategy?.cursor ?? 0
  if (versions.length === 0) return null

  const current = versions[cursor]
  const sourceMeta = SOURCE_LABELS[current?.source] || SOURCE_LABELS['user-edit']

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-2 text-[10.5px] text-gray-500"
    >
      <History className="h-3 w-3 text-gray-400" />
      <span className="tabular-nums">
        v{cursor + 1} / {versions.length}
      </span>
      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${sourceMeta.tint}`}>
        {sourceMeta.label}
      </span>
    </motion.div>
  )
}
