import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { FileText, Loader2, Check, AlertCircle } from 'lucide-react'

// Editable Thumbnail Prompt Card — the primary editable surface in Phase 3.1.
// The prompt is what Phase 3.2 will send to an image generator, so the user
// can refine it now (without generating an image). Autosaves with 800ms
// debounce via the hook.
//
// Save state chip shows: idle/saving/saved/error.

function SaveChip({ saveState, lastSavedAt }) {
  if (saveState === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Saving…
      </span>
    )
  }
  if (saveState === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-700">
        <Check className="h-2.5 w-2.5" />
        Saved
      </span>
    )
  }
  if (saveState === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-100 bg-red-50 px-1.5 py-0.5 text-[9.5px] font-bold text-red-700">
        <AlertCircle className="h-2.5 w-2.5" />
        Save failed
      </span>
    )
  }
  return null
}

export default function ThumbnailPromptCard({ prompt, onEdit, saveState, lastSavedAt }) {
  const textareaRef = useRef(null)

  // Auto-grow textarea to fit content.
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.max(120, ta.scrollHeight)}px`
  }, [prompt])

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-gray-100 bg-white p-4"
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-50 text-sky-600">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <h4 className="text-[12px] font-bold text-gray-900">Generation Prompt</h4>
          <span className="text-[10px] text-gray-400">editable</span>
        </div>
        <SaveChip saveState={saveState} lastSavedAt={lastSavedAt} />
      </div>

      <p className="text-[10.5px] text-gray-500 leading-relaxed mb-2">
        Refine this prompt to match your vision. Phase 3.2 will send it to an image generator.
      </p>

      <textarea
        ref={textareaRef}
        value={prompt || ''}
        onChange={(e) => onEdit(e.target.value)}
        placeholder="The thumbnail prompt will appear here once you generate a strategy. Edit it freely."
        className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5 text-[12px] text-gray-800 leading-relaxed focus:outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100 transition"
        style={{ minHeight: '120px' }}
        spellCheck={true}
      />

      <div className="flex items-center justify-between mt-2">
        <p className="text-[10px] text-gray-400">
          {prompt ? `${prompt.split(/\s+/).filter(Boolean).length} words` : 'No prompt yet'}
        </p>
        <p className="text-[10px] text-gray-400">
          Autosaves on stop
        </p>
      </div>
    </motion.div>
  )
}
