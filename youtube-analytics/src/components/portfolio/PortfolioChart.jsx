import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { BarChart3, HelpCircle } from 'lucide-react'
import { usePlatform } from '../../hooks/usePlatform'
import { usePlatformAdapter } from '../../platformAdapters'
import EstimatedBadge from '../ui/EstimatedBadge'
import { buildPortfolioSeries, buildPortfolioTotals } from '../../utils/portfolioHistory'
import { fmt } from '../../utils/format'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

function fmtNum(n) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(Math.round(n))
}

const tooltipStyle = {
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid #F3F4F6',
  borderRadius: 12,
  boxShadow: '0 4px 16px -4px rgba(0,0,0,0.08)',
  fontSize: 11,
  padding: '8px 10px',
}

export default function PortfolioChart({ selectedIds, range }) {
  const { selectedPlatform } = usePlatform()
  const { accounts: allChannels } = usePlatformAdapter()
  const [activeMetric, setActiveMetric] = useState('views')

  const METRICS = useMemo(() => [
    { key: 'views', label: 'Views', color: '#EF4444' },
    { key: 'subscribers', label: selectedPlatform === 'youtube' ? 'Subscribers' : 'Followers', color: '#3B82F6' },
    { key: 'watchTime', label: selectedPlatform === 'youtube' ? 'Watch Time' : 'Impressions', color: '#F59E0B' },
    { key: 'engagement', label: 'Engagement', color: '#8B5CF6' },
  ], [selectedPlatform])

  const activeChannels = useMemo(() => {
    return (allChannels || []).filter(c => selectedIds.includes(c.id))
  }, [allChannels, selectedIds])

  const series = useMemo(
    () => buildPortfolioSeries(activeChannels, range || '30D', activeMetric),
    [activeChannels, range, activeMetric],
  )

  const totals = useMemo(
    () => buildPortfolioTotals(activeChannels, range || '30D'),
    [activeChannels, range],
  )

  const totalForMetric = totals[activeMetric] ?? 0
  const headlineLabel = METRICS.find((m) => m.key === activeMetric)?.label || 'Views'

  if (activeChannels.length === 0) {
    return (
      <div className="rounded-[20px] border border-gray-100 bg-white p-6 space-y-6" style={{ boxShadow: cs }}>
        <Header range={range} />
        <div className="h-[320px] flex flex-col items-center justify-center gap-2 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/20">
          <HelpCircle className="h-8 w-8 text-gray-300" />
          <div>
            <p className="text-sm font-bold text-gray-500">No channels selected</p>
            <p className="text-xs text-gray-300 mt-0.5">Toggle channel cards in the selector above to visualize performance trends</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-[20px] border border-gray-100 bg-white p-6 space-y-5"
      style={{ boxShadow: cs }}
    >
      <Header
        range={range}
        estimated={<EstimatedBadge className="ml-2" />}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex rounded-xl border border-gray-100 bg-gray-50 p-1">
          {METRICS.map((met) => (
            <button
              key={met.key}
              onClick={() => setActiveMetric(met.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                activeMetric === met.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: met.color }} />
              {met.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px] font-bold text-gray-500 select-none shadow-sm">
          <span>Range: {range || '30D'}</span>
        </div>
      </div>

      <div className="flex items-baseline gap-2.5">
        <span className="text-[28px] font-bold text-gray-900 tracking-[-0.02em] leading-none">
          {activeMetric === 'engagement' ? `${fmtNum(totalForMetric)}%` : fmtNum(totalForMetric)}
        </span>
        <span className="text-[11px] font-bold text-gray-400">total {headlineLabel.toLowerCase()} • {range || '30D'}</span>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 5, right: 14, left: -6, bottom: 0 }}>
            <defs>
              {activeChannels.map((c) => (
                <linearGradient key={c.id} id={`grad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.color || '#3B82F6'} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={c.color || '#3B82F6'} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
              dy={8}
            />
            <YAxis
              tickFormatter={fmtNum}
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v, name) => [activeMetric === 'engagement' ? `${fmtNum(v)}%` : fmtNum(v), name]}
              labelStyle={{ color: '#6B7280', fontSize: 11, marginBottom: 4 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="circle"
            />
            {activeChannels.map((c) => (
              <Area
                key={c.id}
                type="monotone"
                dataKey={c.name || c.id}
                stroke={c.color || '#3B82F6'}
                strokeWidth={2.25}
                fill={`url(#grad-${c.id})`}
                dot={false}
                activeDot={{ r: 4, stroke: c.color || '#3B82F6', strokeWidth: 2, fill: '#fff' }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}

function Header({ range, estimated }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
        <BarChart3 className="h-5 w-5" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Multi-Channel Performance</h3>
          {estimated}
        </div>
        <p className="text-[11px] text-gray-400">Compare views, growth rate, and engagement velocity side-by-side</p>
      </div>
    </div>
  )
}
