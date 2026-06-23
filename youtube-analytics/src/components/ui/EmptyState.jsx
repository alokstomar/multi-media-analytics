import { motion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'

export default function EmptyState({
  title = "No data available",
  description = "No data could be loaded for this component.",
  icon: Icon = AlertCircle,
  action = null,
  compact = false
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={`flex flex-col items-center justify-center text-center ${compact ? 'py-6 px-4' : 'py-16 px-8'}`}
    >
      <div className="relative mb-4">
        <div className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 ring-1 ring-gray-200/50 ${compact ? 'h-12 w-12' : 'h-16 w-16'}`}>
          <Icon className={`${compact ? 'h-5 w-5' : 'h-7 w-7'} text-gray-400`} />
        </div>
      </div>

      <h4 className="text-sm font-bold text-gray-800 mb-1">{title}</h4>
      <p className="text-xs text-gray-500 max-w-sm mb-4 leading-relaxed">
        {description}
      </p>

      {action}
    </motion.div>
  )
}
