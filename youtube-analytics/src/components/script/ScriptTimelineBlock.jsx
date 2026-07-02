import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import ScriptField from './ScriptField'
import { META_KEYS } from './scriptFieldLabels'
import { blockToPlainText, copyToClipboard } from '../../utils/scriptCopy'

// Imperative handle: parent toolbar can collapse/expand all blocks via ref.
// Each block also registers its DOM node so the TOC can scroll to it.
const ScriptTimelineBlock = forwardRef(function ScriptTimelineBlock(
  { block, index, defaultOpen = true },
  ref,
) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState(false)
  const sectionRef = useRef(null)

  useImperativeHandle(ref, () => ({
    collapse: () => setIsOpen(false),
    expand: () => setIsOpen(true),
    toggle: (next) => setIsOpen(typeof next === 'boolean' ? next : (v) => !v),
    scrollIntoView: (opts) => sectionRef.current?.scrollIntoView(opts),
    getOpen: () => isOpen,
  }))

  // Reset copied badge
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  const handleCopy = async (e) => {
    e.stopPropagation()
    const ok = await copyToClipboard(blockToPlainText(block))
    if (ok) setCopied(true)
  }

  const timestamp = block.timestamp
  const sectionName = block.sectionName || `Section ${index + 1}`
  const fieldEntries = Object.entries(block).filter(([k]) => !META_KEYS.has(k))

  return (
    <section
      ref={sectionRef}
      data-block-index={index}
      className="scroll-mt-32 rounded-2xl border border-gray-100 bg-white overflow-hidden transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        aria-expanded={isOpen}
      >
        {timestamp && (
          <span className="inline-flex items-center justify-center rounded-md bg-violet-50 text-violet-700 text-[11px] font-bold px-2 py-1 min-w-[58px] text-center">
            {timestamp}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-[14.5px] font-bold text-gray-900 tracking-tight truncate">{sectionName}</h3>
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={handleCopy}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopy(e) } }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition cursor-pointer"
          title="Copy this section"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </span>
        <motion.div animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="px-5 pb-5 pt-1 border-t border-gray-50 space-y-4">
              {fieldEntries.length === 0 ? (
                <p className="text-[12px] text-gray-400 italic pt-2">No additional detail provided for this section.</p>
              ) : (
                fieldEntries.map(([key, value]) => (
                  <ScriptField key={key} fieldKey={key} value={value} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
})

export default ScriptTimelineBlock
