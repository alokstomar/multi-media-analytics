import { useRef, useImperativeHandle, forwardRef } from 'react'
import { motion } from 'framer-motion'
import ScriptTimelineBlock from './ScriptTimelineBlock'

// Parent holds refs to all block instances so the toolbar can issue
// expand-all / collapse-all commands in one shot.
const ScriptTimeline = forwardRef(function ScriptTimeline({ blocks = [] }, ref) {
  const blockRefs = useRef([])

  useImperativeHandle(ref, () => ({
    expandAll: () => blockRefs.current.forEach((b) => b?.expand?.()),
    collapseAll: () => blockRefs.current.forEach((b) => b?.collapse?.()),
    scrollToIndex: (index, opts) => blockRefs.current[index]?.scrollIntoView?.(opts),
  }))

  if (!Array.isArray(blocks) || blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-gray-500">No timeline returned.</p>
        <p className="text-xs text-gray-400 mt-1">Try regenerating the script.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <motion.div
          key={block.sectionName ? `${block.sectionName}-${i}` : i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: Math.min(i * 0.04, 0.32) }}
        >
          <ScriptTimelineBlock
            ref={(el) => { blockRefs.current[i] = el }}
            block={block}
            index={i}
            defaultOpen={i === 0}
          />
        </motion.div>
      ))}
    </div>
  )
})

export default ScriptTimeline
