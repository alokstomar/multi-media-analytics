import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { BarChart3, HelpCircle, Eye, Users, Clock, Sparkles } from 'lucide-react'
import { usePlatform } from '../../hooks/usePlatform'
import { usePlatformAdapter } from '../../platformAdapters'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

export default function PortfolioChart({ selectedIds, range }) {
  const { selectedPlatform } = usePlatform()
  const { accounts: allChannels } = usePlatformAdapter()
  const [activeMetric, setActiveMetric] = useState('Views')

  const METRICS = useMemo(() => [
    { name: 'Views', icon: Eye, color: '#EF4444' },
    { name: selectedPlatform === 'youtube' ? 'Subscribers' : 'Followers', icon: Users, color: '#3B82F6' },
    { name: selectedPlatform === 'youtube' ? 'Watch Time' : 'Impressions', icon: Clock, color: '#F59E0B' },
    { name: 'Engagement', icon: Sparkles, color: '#8B5CF6' }
  ], [selectedPlatform])

  const activeChannels = useMemo(() => {
    return allChannels.filter(c => selectedIds.includes(c.id))
  }, [allChannels, selectedIds])

  // Dynamically calculate chart points based on selected channels, active metrics, and the prop 'range'
  const chartData = useMemo(() => {
    let dataPoints = []
    const now = new Date()

    if (range === '7D') {
      // Generate 7 daily data points
      dataPoints = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(now.getDate() - (6 - i))
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        
        const point = { date: label }
        activeChannels.forEach(c => {
          const raw = c._raw || {}
          const analytics = c._analytics || {}
          let baseVal = 10000

          if (activeMetric === 'Views') {
            baseVal = Number(raw.totalViews || 1500000) / 180
          } else if (activeMetric === 'Subscribers' || activeMetric === 'Followers') {
            baseVal = Number(raw.subscribers || 450000) / 180
          } else if (activeMetric === 'Watch Time' || activeMetric === 'Impressions') {
            baseVal = (Number(raw.totalViews || 1500000) * 0.08) / 180
          } else {
            baseVal = Number(analytics.engagementRate || raw.engagementRate || 3.5)
          }

          const variance = 0.8 + (Math.sin(i + c.name.length) * 0.15)
          point[c.name] = activeMetric === 'Engagement'
            ? Number((baseVal * variance).toFixed(1))
            : Math.round(baseVal * variance)
        })
        return point
      })
    } else if (range === '30D') {
      // Generate 15 bi-daily data points
      dataPoints = Array.from({ length: 15 }, (_, i) => {
        const d = new Date()
        d.setDate(now.getDate() - (14 - i) * 2)
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

        const point = { date: label }
        activeChannels.forEach(c => {
          const raw = c._raw || {}
          const analytics = c._analytics || {}
          let baseVal = 20000

          if (activeMetric === 'Views') {
            baseVal = (Number(raw.totalViews || 1500000) / 180) * 2
          } else if (activeMetric === 'Subscribers' || activeMetric === 'Followers') {
            baseVal = (Number(raw.subscribers || 450000) / 180) * 2
          } else if (activeMetric === 'Watch Time' || activeMetric === 'Impressions') {
            baseVal = ((Number(raw.totalViews || 1500000) * 0.08) / 180) * 2
          } else {
            baseVal = Number(analytics.engagementRate || raw.engagementRate || 3.5)
          }

          const variance = 0.8 + (Math.sin(i + c.name.length) * 0.15)
          point[c.name] = activeMetric === 'Engagement'
            ? Number((baseVal * variance).toFixed(1))
            : Math.round(baseVal * variance)
        })
        return point
      })
    } else if (range === '90D') {
      // Generate 12 weekly data points
      dataPoints = Array.from({ length: 12 }, (_, i) => {
        const point = { date: `Wk ${i + 1}` }
        activeChannels.forEach(c => {
          const raw = c._raw || {}
          const analytics = c._analytics || {}
          let baseVal = 70000

          if (activeMetric === 'Views') {
            baseVal = (Number(raw.totalViews || 1500000) / 180) * 7
          } else if (activeMetric === 'Subscribers' || activeMetric === 'Followers') {
            baseVal = (Number(raw.subscribers || 450000) / 180) * 7
          } else if (activeMetric === 'Watch Time' || activeMetric === 'Impressions') {
            baseVal = ((Number(raw.totalViews || 1500000) * 0.08) / 180) * 7
          } else {
            baseVal = Number(analytics.engagementRate || raw.engagementRate || 3.5)
          }

          const variance = 0.8 + (Math.sin(i + c.name.length) * 0.15)
          point[c.name] = activeMetric === 'Engagement'
            ? Number((baseVal * variance).toFixed(1))
            : Math.round(baseVal * variance)
        })
        return point
      })
    } else {
      // '1Y' -> Generate 12 monthly data points
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      dataPoints = months.map((m, monthIdx) => {
        const point = { date: m }
        activeChannels.forEach(c => {
          const raw = c._raw || {}
          const analytics = c._analytics || {}
          let baseVal = 100000

          if (activeMetric === 'Views') {
            baseVal = Number(raw.totalViews || 1500000) * 0.15
          } else if (activeMetric === 'Subscribers' || activeMetric === 'Followers') {
            baseVal = Number(raw.subscribers || 450000) * 0.15
          } else if (activeMetric === 'Watch Time' || activeMetric === 'Impressions') {
            baseVal = (Number(raw.totalViews || 1500000) * 0.08) * 0.15
          } else {
            baseVal = Number(analytics.engagementRate || raw.engagementRate || 3.5)
          }

          const factor = 0.75 + (monthIdx * 0.04)
          const variance = 0.94 + (Math.sin(monthIdx + c.name.length) * 0.06)
          
          point[c.name] = activeMetric === 'Engagement'
            ? Number((baseVal * variance).toFixed(1))
            : Math.round(baseVal * factor * variance)
        })
        return point
      })
    }

    return dataPoints
  }, [activeChannels, activeMetric, range])

  function fmt(n) {
    if (activeMetric === 'Engagement') return `${n}%`
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return String(n)
  }

  // Custom tooltips matching theme aesthetics
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-2xl border border-gray-100 bg-white/95 p-4 shadow-xl min-w-[200px]">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{label} Performance</p>
          <div className="space-y-1.5">
            {payload.map((item, index) => (
              <div key={index} className="flex items-center justify-between gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.stroke }} />
                  <span className="text-gray-600 truncate">{item.name}</span>
                </div>
                <span className="text-gray-900 font-bold">{fmt(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="rounded-[20px] border border-gray-100 bg-white p-6 space-y-6" style={{ boxShadow: cs }}>
      {/* Chart controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Multi-Channel Performance</h3>
            <p className="text-[11px] text-gray-400">Compare views, growth rate, and engagement velocity side-by-side</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Metrics controls */}
          <div className="flex rounded-xl border border-gray-100 bg-gray-50 p-1">
            {METRICS.map((met) => {
              const Icon = met.icon
              const isSelected = activeMetric === met.name
              return (
                <button
                  key={met.name}
                  onClick={() => setActiveMetric(met.name)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                    isSelected || (met.name === 'Subscribers' && activeMetric === 'Followers') || (met.name === 'Watch Time' && activeMetric === 'Impressions')
                      ? 'bg-white text-gray-900 shadow-sm border border-gray-100/50'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: isSelected || (met.name === 'Subscribers' && activeMetric === 'Followers') || (met.name === 'Watch Time' && activeMetric === 'Impressions') ? met.color : undefined }} />
                  {met.name}
                </button>
              )
            })}
          </div>

          {/* Timeframe indicator (synced with page-level selector) */}
          <div className="flex items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px] font-bold text-gray-400 select-none shadow-sm">
            <span>Range: {range || '30D'}</span>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      {activeChannels.length === 0 ? (
        <div className="h-[320px] flex flex-col items-center justify-center gap-2 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/20">
          <HelpCircle className="h-8 w-8 text-gray-300 animate-pulse" />
          <div>
            <p className="text-sm font-bold text-gray-500">No channels selected</p>
            <p className="text-xs text-gray-300 mt-0.5">Toggle channel cards in the selector above to visualize performance trends</p>
          </div>
        </div>
      ) : (
        <div className="h-[320px] w-full text-xs font-semibold">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F9FAFB" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="#9CA3AF"
                tickLine={false}
                axisLine={false}
                tickFormatter={fmt}
                dx={-5}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '20px' }}
              />
              {activeChannels.map((c) => (
                <Line
                  key={c.id}
                  type="monotone"
                  dataKey={c.name}
                  name={c.name}
                  stroke={c.color}
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 1.5, fill: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  animationDuration={350}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
