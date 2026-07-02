import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'

const STATUS_MESSAGES = [
  'Understanding the topic…',
  'Researching the audience…',
  'Creating the hook…',
  'Writing the script…',
  'Planning visuals…',
  'Finalizing production notes…',
]

// Premium loading state. Rotates through status messages without showing
// a fake percentage — OpenAI doesn't expose progress for a single JSON
// response, so we don't pretend otherwise. The progress bar loops forever
// to convey "work is happening" without committing to a numeric ETA.
export default function ScriptGenerationLoader({ isRegenerating = false }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % STATUS_MESSAGES.length)
    }, 2400)
    return () => clearInterval(t)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-[70vh] flex items-center justify-center px-6"
    >
      <div className="w-full max-w-md text-center">
        {/* Animated glowing icon */}
        <div className="relative mx-auto mb-8 h-20 w-20">
          <motion.div
            className="absolute inset-0 rounded-full bg-violet-200"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-2 rounded-full bg-violet-300"
            animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          />
          <div className="relative h-full w-full rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
        </div>

        <h2 className="text-[20px] font-bold text-gray-900 tracking-tight">
          {isRegenerating ? 'Rewriting your script' : 'Writing your production script'}
        </h2>
        <p className="mt-2 text-[13px] text-gray-500">
          {isRegenerating
            ? 'Calling OpenAI for a brand-new draft.'
            : 'Calling OpenAI to draft a complete, production-ready script.'}
        </p>

        {/* Rotating status line */}
        <div className="mt-8 h-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="text-[13px] font-semibold text-violet-700"
            >
              {STATUS_MESSAGES[index]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Looping progress bar — no fake % */}
        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-gray-100">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-400 to-violet-600 rounded-full"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: '60%' }}
          />
        </div>

        <p className="mt-5 text-[11px] text-gray-400">
          First generation may take 15–25 seconds. Cached after — revisit any time.
        </p>
      </div>
    </motion.div>
  )
}
