import { motion } from 'framer-motion'
import { Clock, TrendingUp, Search, AlertTriangle, BarChart3, ArrowRight, Sparkles } from 'lucide-react'

const iconMap = { clock: Clock, trending: TrendingUp, search: Search, alert: AlertTriangle, chart: BarChart3 }

const typeConfig = {
  positive: {
    bar: 'bg-emerald-400',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    title: 'text-gray-900',
    priority: 1,
  },
  info: {
    bar: 'bg-blue-400',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    title: 'text-gray-900',
    priority: 2,
  },
  warning: {
    bar: 'bg-amber-400',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    title: 'text-gray-900',
    priority: 3,
  },
}

export default function AIInsightsPanel({ insights }) {
  const items = Array.isArray(insights) ? insights : []

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm h-full flex flex-col"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 12px -2px rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-gray-900">AI Intelligence</h3>
          <p className="text-[11px] text-gray-400">Smart recommendations</p>
        </div>
      </div>

      {/* Insight cards */}
      <div className="flex-1 space-y-2.5">
        {items.length === 0 ? (
          <div className="py-10 text-center rounded-xl border border-dashed border-gray-100">
            <p className="text-xs font-bold text-gray-500">No AI insights available</p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-[220px] mx-auto">Insights appear once analytics data is connected for this channel</p>
          </div>
        ) : (
          items.map((ins, i) => {
            const config = typeConfig[ins.type] || typeConfig.info
            const Icon = iconMap[ins.icon] || BarChart3

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.45 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="group relative rounded-xl border border-gray-100 bg-white p-3.5 hover:border-gray-200 hover:shadow-sm transition-all duration-200 cursor-pointer overflow-hidden"
              >
                {/* Left severity bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${config.bar}`} />

                <div className="flex items-start gap-3 pl-1">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${config.iconBg} group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className={`h-3.5 w-3.5 ${config.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-semibold ${config.title} leading-tight`}>{ins.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{ins.desc}</p>
                    <button className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 group-hover:text-blue-600 transition-colors duration-200">
                      {ins.action}
                      <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </motion.div>
  )
}
