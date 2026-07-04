import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Visual treatment per priority level. Uses only existing palette tints.
const TINT = {
  CRITICAL:  { dot: 'bg-red-500',    text: 'text-red-700',    chip: 'bg-red-50 text-red-700 border-red-200',    icon: 'text-red-600' },
  IMPORTANT: { dot: 'bg-amber-500',  text: 'text-amber-700',  chip: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'text-amber-600' },
  OPTIONAL:  { dot: 'bg-sky-500',    text: 'text-sky-700',    chip: 'bg-sky-50 text-sky-700 border-sky-200',    icon: 'text-sky-600' },
}

// Collapsible priority section. Children get rendered inside an animated
// container. Header shows priority label + count + collapse chevron.
//
// Default open for CRITICAL, closed for others when there are CRITICAL
// items; otherwise all open.
export default function PriorityGroup({ priority, items = [], children, defaultOpen }) {
  const tint = TINT[priority.key] || TINT.OPTIONAL
  const [open, setOpen] = useState(defaultOpen ?? priority.key === 'CRITICAL')

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-gray-100 bg-white overflow-hidden"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50/50 transition cursor-pointer"
      >
        <span className={`h-2 w-2 rounded-full shrink-0 ${tint.dot}`} />
        <span className={`text-[11px] font-bold uppercase tracking-wider ${tint.text}`}>{priority.label}</span>
        <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 tabular-nums">
          {items.length}
        </span>
        <span className="text-[10.5px] text-gray-400 ml-auto flex items-center gap-1">
          {priority.key === 'CRITICAL' && 'fix before publishing'}
          {priority.key === 'IMPORTANT' && 'verify when time allows'}
          {priority.key === 'OPTIONAL' && 'polish & clarity'}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className="p-3 space-y-2 bg-gray-50/30">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
