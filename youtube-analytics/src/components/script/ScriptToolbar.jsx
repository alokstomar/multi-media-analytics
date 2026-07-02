import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Copy, Check, ChevronsDownUp, ChevronsUpDown, Sparkles,
} from 'lucide-react'

// Sticky top toolbar. Surfaces the high-value actions: regenerate, copy all,
// expand/collapse all. Also displays reading time + generation timestamp.
function ToolbarButton({ icon: Icon, label, onClick, disabled, accent = 'default', loading = false }) {
  const base =
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
  const tones = {
    default: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
    primary: 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-500/20',
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} className={`${base} ${tones[accent]}`}>
      <Icon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
      {label}
    </button>
  )
}

export default function ScriptToolbar({
  onRegenerate,
  onCopyAll,
  onExpandAll,
  onCollapseAll,
  readingTimeMin,
  generatedAt,
  isRegenerating,
  sectionsCount,
}) {
  const [copiedAll, setCopiedAll] = useState(false)

  const handleCopyAll = async () => {
    const ok = await onCopyAll()
    if (ok) {
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 1800)
    }
  }

  const genLabel = generatedAt
    ? new Date(generatedAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-30 -mx-4 sm:mx-0 sm:rounded-2xl border border-gray-100 bg-white/85 backdrop-blur-md"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.05)' }}
    >
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold text-gray-900 tracking-tight truncate">AI Production Script</p>
            <p className="text-[10.5px] text-gray-500 truncate">
              {sectionsCount != null && `${sectionsCount} section${sectionsCount === 1 ? '' : 's'}`}
              {readingTimeMin != null && ` · ${readingTimeMin} min read`}
              {genLabel && ` · Generated ${genLabel}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ToolbarButton
            icon={RefreshCw}
            label={isRegenerating ? 'Regenerating…' : 'Regenerate'}
            onClick={onRegenerate}
            loading={isRegenerating}
            accent="primary"
          />
          <ToolbarButton
            icon={copiedAll ? Check : Copy}
            label={copiedAll ? 'Copied' : 'Copy Script'}
            onClick={handleCopyAll}
          />
          <ToolbarButton icon={ChevronsUpDown} label="Expand All" onClick={onExpandAll} />
          <ToolbarButton icon={ChevronsDownUp} label="Collapse All" onClick={onCollapseAll} />
        </div>
      </div>
    </motion.div>
  )
}
