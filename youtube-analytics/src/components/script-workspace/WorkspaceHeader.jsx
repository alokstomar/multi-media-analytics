import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, Sparkles, Check, Loader2, AlertCircle } from 'lucide-react'

function formatSavedAt(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return date.toLocaleDateString()
}

export default function WorkspaceHeader({ channel, saveState, lastSavedAt, isRegenerating }) {
  const channelName = channel?.title || 'channel'

  const pill = (() => {
    if (isRegenerating) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-700 border border-violet-100">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating…
        </span>
      )
    }
    if (saveState === 'saving') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 border border-amber-100">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </span>
      )
    }
    if (saveState === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold text-red-700 border border-red-100">
          <AlertCircle className="h-3 w-3" />
          Save failed
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-100">
        <Check className="h-3 w-3" />
        Saved {formatSavedAt(lastSavedAt)}
      </span>
    )
  })()

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
    >
      <div className="space-y-2">
        <Link
          to="/content-intelligence"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {channelName}
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Script Workspace</h1>
            <p className="text-[12.5px] text-gray-500 font-medium mt-0.5">
              Channel-aware AI content studio · single source of truth for downstream AI
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">{pill}</div>
    </motion.div>
  )
}
