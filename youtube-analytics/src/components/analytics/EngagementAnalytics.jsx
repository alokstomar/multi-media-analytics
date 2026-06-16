import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fmt } from '../../utils/format'
import { seededFloat } from '../../utils/deterministic'
import { tooltipStyleCompact } from '../../data/chartConfigs'

const tabs = [
  { key: 'likes', label: 'Likes', color: '#EF4444' },
  { key: 'comments', label: 'Comments', color: '#3B82F6' },
  { key: 'shares', label: 'Shares', color: '#10B981' },
  { key: 'subs', label: 'Subs Gained', color: '#8B5CF6' },
]

function getRangeEngagementData(range, chartData) {
  const latestMonthData = chartData[chartData.length - 1] || { likes: 620000, comments: 93000, shares: 230000, subs: 380000 }
  
  const now = new Date()
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const keys = ['likes', 'comments', 'shares', 'subs']

  const dailyBases = {}
  keys.forEach(k => {
    dailyBases[k] = latestMonthData[k] / 30
  })

  if (range === '7D') {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(now.getDate() - (6 - i))
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const variance = seededFloat(`eng-7d-${i}`, 0.8, 1.2)
      
      const item = { date: label }
      keys.forEach(k => {
        item[k] = Math.round(dailyBases[k] * variance)
      })
      return item
    })
  }

  if (range === '30D') {
    return Array.from({ length: 15 }, (_, i) => {
      const d = new Date()
      d.setDate(now.getDate() - (14 - i) * 2)
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const variance = seededFloat(`eng-30d-${i}`, 0.82, 1.18)
      
      const item = { date: label }
      keys.forEach(k => {
        item[k] = Math.round(dailyBases[k] * 2 * variance)
      })
      return item
    })
  }

  if (range === '90D') {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date()
      d.setDate(now.getDate() - (11 - i) * 7)
      const label = `Wk ${i + 1}`
      const variance = seededFloat(`eng-90d-${i}`, 0.85, 1.15)
      
      const item = { date: label }
      keys.forEach(k => {
        item[k] = Math.round(dailyBases[k] * 7 * variance)
      })
      return item
    })
  }

  // '1Y' Range
  const result = []
  
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = MONTHS[d.getMonth()]
    
    const existing = chartData.find(c => c.date === label)
    if (existing) {
      result.push(existing)
    } else {
      const factor = 1 - (i * 0.03)
      const variance = seededFloat(`eng-1y-${i}`, 0.9, 1.1)
      
      const item = { date: label }
      keys.forEach(k => {
        item[k] = Math.round(latestMonthData[k] * 0.8 * factor * variance)
      })
      result.push(item)
    }
  }
  return result
}

export default function EngagementAnalytics({ data, range }) {
  const [active, setActive] = useState('likes')
  const rawData = data || []
  const engData = getRangeEngagementData(range, rawData)
  const t = tabs.find((x) => x.key === active)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 12px -2px rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h3 className="text-[16px] font-bold text-gray-900 tracking-[-0.01em]">Engagement Trends</h3>
          <p className="text-[12px] text-gray-400">Likes, comments, shares &amp; subscriber conversion</p>
        </div>
        <div className="flex rounded-lg bg-gray-100/80 p-[3px]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`relative px-3 py-[5px] rounded-md text-[11px] font-semibold transition-all duration-200 ${
                active === tab.key
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {active === tab.key && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full"
                  style={{ backgroundColor: tab.color }}
                />
              )}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {tabs.map((tab) => {
          const lastVal = engData && engData.length > 0 ? (engData[engData.length - 1]?.[tab.key] || 0) : 0
          const prevVal = engData && engData.length > 1 ? (engData[engData.length - 2]?.[tab.key] || 0) : 0
          const growth = prevVal > 0 ? (((lastVal - prevVal) / prevVal) * 100).toFixed(1) : '0.0'
          const isActive = active === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`rounded-xl p-3 text-left border transition-all duration-200 ${
                isActive
                  ? 'border-gray-200 bg-gray-50 shadow-sm'
                  : 'border-transparent hover:bg-gray-50/80'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="h-[6px] w-[6px] rounded-full"
                  style={{ backgroundColor: tab.color, opacity: isActive ? 1 : 0.4 }}
                />
                <p className="text-[11px] text-gray-400 font-medium">{tab.label}</p>
              </div>
              <p className="text-[18px] font-bold text-gray-900 tracking-[-0.01em]">{fmt(lastVal)}</p>
              <p className={`text-[11px] font-semibold mt-0.5 ${parseFloat(growth) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {parseFloat(growth) >= 0 ? '+' : ''}{growth}%
              </p>
            </button>
          )
        })}
      </div>

      {/* Chart */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={engData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={t.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} dy={8} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip
                contentStyle={tooltipStyleCompact}
                formatter={(v) => [fmt(v), t.label]}
                labelStyle={{ color: '#6B7280', fontSize: 11, marginBottom: 4 }}
              />
              <Area
                type="monotone"
                dataKey={active}
                stroke={t.color}
                strokeWidth={2.5}
                fill="url(#engGrad)"
                dot={false}
                activeDot={{
                  r: 5,
                  stroke: t.color,
                  strokeWidth: 2,
                  fill: '#fff',
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
