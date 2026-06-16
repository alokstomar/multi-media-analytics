import { motion } from 'framer-motion'
import { Plus, Tv, ArrowRight } from 'lucide-react'

export default function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-24 px-8"
    >
      {/* Illustration */}
      <div className="relative mb-8">
        <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-100 ring-1 ring-blue-100">
          <Tv className="h-16 w-16 text-blue-400" />
        </div>
        {/* floating dots */}
        <div className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-purple-400 animate-bounce" />
        <div className="absolute -bottom-1 -left-3 h-3 w-3 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
        <div className="absolute top-2 -left-4 h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0.4s' }} />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">No channels yet</h2>
      <p className="text-sm text-gray-500 text-center max-w-md mb-8 leading-relaxed">
        Connect your first YouTube channel to unlock powerful analytics, AI insights, and growth tracking for your content.
      </p>

      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-lg shadow-blue-500/25">
          <Plus className="h-4 w-4" />
          Add Your First Channel
        </button>
        <button className="flex items-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
          Watch Demo
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-6 mt-10 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          Real-time sync
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          AI-powered insights
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
          Multi-channel support
        </span>
      </div>
    </motion.div>
  )
}
