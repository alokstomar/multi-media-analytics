import { useState } from 'react'
import { motion } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fmt } from '../../utils/format'
import { tooltipStyle } from '../../data/chartConfigs'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useAnalytics } from '../../context/AnalyticsContext'
import EstimatedBadge from '../ui/EstimatedBadge'
import { getRangePerformanceData } from '../../utils/analyticsRange'

export default function PerformanceChart({ data, channelColor, range, hasEstimates }) {
  const { activeChannel } = useAnalytics()
  const [period, setPeriod] = useState('Monthly')
  const [metric, setMetric] = useState('views')

  const chartData = data || []
  const primaryColor = channelColor || '#3B82F6'

  const { data: rangeData, estimated: rangeEstimated } = getRangePerformanceData(range, chartData)
  const showEstimated = hasEstimates || rangeEstimated

  const displayData = (range === '1Y' && period === 'Weekly')
    ? rangeData.flatMap((m) => {
        const estBaseViews = m.views / 4
        return Array.from({ length: 4 }, (_, i) => {
          const v = Math.round(estBaseViews * (0.9 + i * 0.05))
          return {
            date: `${m.date} W${i + 1}`,
            views: v,
            watchTime: Math.round(v * 0.08),
            isEstimated: true,
          }
        })
      })
    : rangeData

  const totalVal = displayData.reduce((s, d) => s + (d[metric] || 0), 0)

  const metrics = [
    { key: 'views', label: 'Views' },
    { key: 'watchTime', label: 'Watch Time' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-6 pt-5 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[17px] font-bold text-gray-900 tracking-[-0.01em]">Performance Overview</h3>
              {showEstimated && <EstimatedBadge />}
            </div>
            <p className="text-[12px] text-gray-400 mt-0.5">
              {range === '1Y' ? 'Monthly views from uploaded videos' : 'Daily/weekly breakdown estimated from monthly totals'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-gray-100/80 p-[3px]">
              {metrics.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  className={`px-3 py-[5px] rounded-md text-[11px] font-semibold transition-all duration-200 ${
                    metric === m.key
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {(range === '7D' || range === '30D' || range === '90D') ? (
              <span className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-[5px] text-[11px] font-semibold text-gray-400 select-none">
                {range === '90D' ? 'Weekly' : 'Daily'}
              </span>
            ) : (
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-[5px] text-[11px] font-semibold text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-200 cursor-pointer"
              >
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            )}
          </div>
        </div>

        <div className="flex items-baseline gap-2.5 mt-4 mb-1">
          <span className="text-[28px] font-bold text-gray-900 tracking-[-0.02em] leading-none">
            {fmt(totalVal)}
            {metric === 'watchTime' && <span className="text-sm font-semibold text-gray-500 ml-1">hrs</span>}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold ${
            activeChannel?.growthUp ?? true
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-red-50 text-red-500'
          }`}>
            {activeChannel?.growthUp ?? true ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {activeChannel?.growth || '+0%'}
          </span>
          <span className="text-[11px] text-gray-400">vs last period</span>
        </div>
      </div>

      <div className="px-2 pb-5">
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={displayData} margin={{ top: 5, right: 14, left: -6, bottom: 0 }}>
            <defs>
              <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primaryColor} stopOpacity={0.18} />
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} dy={8} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v) => [fmt(v), metric === 'views' ? 'Views' : 'Watch Time (hrs)']}
              labelStyle={{ color: '#6B7280', fontSize: 11, marginBottom: 4 }}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={primaryColor}
              strokeWidth={2.5}
              fill="url(#perfGrad)"
              dot={false}
              activeDot={{ r: 5, stroke: primaryColor, strokeWidth: 2, fill: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
