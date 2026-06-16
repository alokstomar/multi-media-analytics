import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Sparkles, Activity, Eye, Zap, RefreshCw } from 'lucide-react'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

export default function MetricsOverview({ channelData }) {
  const stats = useMemo(() => {
    const overview = channelData._raw?.overview || {}
    const growth = overview.viewsGrowth || 0
    const eng = overview.engagementRate || 0

    const healthBase = Math.min(98, Math.max(50, Math.round(75 + growth * 0.5)))
    const trendBase = Math.min(99, Math.max(45, Math.round(70 + eng * 2)))
    const interestBase = Math.min(98, Math.max(50, Math.round(75 + eng * 1.5)))
    const shortsBase = Math.min(99, Math.max(40, Math.round(65 + growth * 0.4)))
    const uploadBase = Math.min(98, Math.max(30, Math.round(80 + (overview.uploadFrequency || 3) * 3)))

    return [
      {
        label: 'Content Health',
        value: `${healthBase}%`,
        color: '#8B5CF6',
        icon: Sparkles,
        trend: '+2.4%',
        confidence: '94%',
        spark: [78, 81, 80, 84, 83, 86, healthBase]
      },
      {
        label: 'Trending Opportunity',
        value: `${trendBase}%`,
        color: '#EF4444',
        icon: Activity,
        trend: '+4.8%',
        confidence: '88%',
        spark: [65, 70, 75, 72, 80, 85, trendBase]
      },
      {
        label: 'Audience Interest',
        value: `${interestBase}%`,
        color: '#3B82F6',
        icon: Eye,
        trend: '+1.5%',
        confidence: '92%',
        spark: [72, 75, 78, 82, 80, 84, interestBase]
      },
      {
        label: 'Shorts Potential',
        value: `${shortsBase}%`,
        color: '#F59E0B',
        icon: Zap,
        trend: '+6.1%',
        confidence: '85%',
        spark: [60, 68, 70, 74, 78, 80, shortsBase]
      },
      {
        label: 'Upload Consistency',
        value: `${uploadBase}%`,
        color: '#10B981',
        icon: RefreshCw,
        trend: '+0.8%',
        confidence: '97%',
        spark: [85, 88, 87, 89, 91, 90, uploadBase]
      }
    ]
  }, [channelData])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((s, i) => {
        const Icon = s.icon
        const sparkData = s.spark.map((v) => ({ v }))
        return (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05, ease: [0.25, 1, 0.5, 1] }}
            className="group rounded-[20px] border border-gray-100 bg-white p-5 transition-all duration-300 hover:shadow-md"
            style={{
              boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 12px -2px rgba(0,0,0,0.04)'
            }}
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                style={{ backgroundColor: `${s.color}12` }}
              >
                <Icon className="h-5 w-5" style={{ color: s.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-gray-400 tracking-wide leading-tight">{s.label}</p>
                <p className="text-[22px] font-bold text-gray-900 tracking-tight leading-none mt-0.5">{s.value}</p>
              </div>
            </div>

            <div className="h-[36px] -mx-1 mb-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`spark-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={s.color}
                    strokeWidth={2}
                    fill={`url(#spark-${i})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600">
                {s.trend}
              </span>
              <span className="text-[11px] text-gray-300">vs last 30 days</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
