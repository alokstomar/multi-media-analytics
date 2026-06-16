import { motion } from 'framer-motion'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { Clock, Zap, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import EstimatedBadge from '../ui/EstimatedBadge'

const icons = [Clock, Zap, TrendingUp, DollarSign]

const cardThemes = [
  {
    gradient: 'from-blue-500/5 via-blue-50/50 to-transparent',
    iconBg: 'bg-blue-600',
    iconText: 'text-white',
    stroke: '#3B82F6',
    accent: '#3B82F6',
    bar: 'bg-blue-500',
  },
  {
    gradient: 'from-violet-500/5 via-violet-50/50 to-transparent',
    iconBg: 'bg-violet-600',
    iconText: 'text-white',
    stroke: '#8B5CF6',
    accent: '#8B5CF6',
    bar: 'bg-violet-500',
  },
  {
    gradient: 'from-emerald-500/5 via-emerald-50/50 to-transparent',
    iconBg: 'bg-emerald-600',
    iconText: 'text-white',
    stroke: '#10B981',
    accent: '#10B981',
    bar: 'bg-emerald-500',
  },
  {
    gradient: 'from-amber-500/5 via-amber-50/50 to-transparent',
    iconBg: 'bg-amber-500',
    iconText: 'text-white',
    stroke: '#F59E0B',
    accent: '#F59E0B',
    bar: 'bg-amber-500',
  },
]

function scaleStatValue(valStr, unit, range) {
  let val = parseFloat(valStr.replace(/[$,K,M]/g, ''))
  if (isNaN(val)) return valStr

  let scale = 1
  if (range === '7D') scale = 1 / 26
  else if (range === '30D') scale = 1 / 6
  else if (range === '90D') scale = 1 / 2
  else if (range === '1Y') scale = 2

  let scaled = val * scale
  
  const hasDollar = valStr.startsWith('$')
  const hasK = valStr.includes('K')
  const hasM = valStr.includes('M')

  let formatted = ''
  if (hasM) {
    formatted = `${scaled.toFixed(1)}M`
  } else if (hasK) {
    formatted = `${scaled.toFixed(1)}K`
  } else {
    formatted = scaled >= 1000 ? `${(scaled / 1000).toFixed(1)}K` : scaled.toFixed(1)
  }

  if (hasDollar) formatted = `$${formatted}`
  return formatted
}

export default function AnalyticsStats({ data, range }) {
  const stats = data || []
  
  // Scale only cumulative/volume metrics, keeping ratios (CTR, Engagement Rate) stable
  const scaledStats = stats.map((s) => {
    const isCumulative = s.label === 'Watch Time' || s.label === 'Revenue Growth'
    return {
      ...s,
      value: isCumulative ? scaleStatValue(s.value, s.unit, range) : s.value,
    }
  })

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {scaledStats.map((s, i) => {
        const Icon = icons[i % icons.length]
        const theme = cardThemes[i % cardThemes.length]
        const sparkData = s.spark.map((v) => ({ v }))
        const isUp = s.trend.startsWith('+')

        return (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 pb-4 transition-all duration-300 hover:border-gray-200 cursor-pointer"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 12px -2px rgba(0,0,0,0.04)' }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
          >
            {/* Subtle gradient overlay on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

            {/* Top accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)` }}
            />

            <div className="relative">
              {/* Top row: label + icon */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-[12px] font-medium text-gray-400 tracking-wide">{s.label}</p>
                  {s.estimated && <EstimatedBadge />}
                </div>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${theme.iconBg} shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-300`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </div>

              {/* Value */}
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[26px] font-bold text-gray-900 tracking-[-0.02em] leading-none">{s.value}</span>
                <span className="text-[13px] text-gray-400 font-medium">{s.unit}</span>
              </div>

              {/* Bottom row: sparkline + trend */}
              <div className="flex items-center justify-between mt-2">
                <span className={`inline-flex items-center gap-[3px] rounded-full px-2 py-[3px] text-[11px] font-semibold ${
                  isUp
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-500'
                }`}>
                  {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {s.trend}
                </span>

                <div className="h-6 w-[72px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparkData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`spark-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={theme.stroke} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={theme.stroke} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={theme.stroke}
                        strokeWidth={1.5}
                        fill={`url(#spark-${i})`}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
