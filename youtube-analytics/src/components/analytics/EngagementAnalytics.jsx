import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fmt } from '../../utils/format'
import { tooltipStyleCompact } from '../../data/chartConfigs'

const tabs = [
  { key: 'likes', label: 'Likes', color: '#EF4444' },
  { key: 'comments', label: 'Comments', color: '#3B82F6' },
  { key: 'shares', label: 'Shares', color: '#10B981' },
  { key: 'subs', label: 'Subs Gained', color: '#8B5CF6' },
]

export default function EngagementAnalytics({ data, range }) {
  const [active, setActive] = useState('likes')
  const rawData = Array.isArray(data) ? data : []
  const t = tabs.find((x) => x.key === active) || tabs[0]

  const isInRange = (row) => {
    if (!row || !row.date) return false
    return true
  }
  const engData = rawData.filter(isInRange)
  const hasData = engData.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 4px 12px -2px rgba(0,0,0,0.04)' }}
    >
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

      {!hasData ? (
        <div className="py-12 text-center">
          <p className="text-sm font-bold text-gray-500">No engagement data available</p>
          <p className="text-xs text-gray-400 mt-1">Connect YouTube Analytics API to enable engagement trends</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3 mb-5">
            {tabs.map((tab) => {
              const lastVal = engData[engData.length - 1]?.[tab.key] || 0
              const prevVal = engData.length > 1 ? (engData[engData.length - 2]?.[tab.key] || 0) : 0
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
        </>
      )}
    </motion.div>
  )
}
