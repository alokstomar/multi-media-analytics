import { useState } from 'react'
import {
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import InsightsPanel from './InsightsPanel'

const VIEWS_DATA = [
  { date: 'Jan', views: 142000 },
  { date: 'Feb', views: 198000 },
  { date: 'Mar', views: 175000 },
  { date: 'Apr', views: 231000 },
  { date: 'May', views: 289000 },
  { date: 'Jun', views: 264000 },
  { date: 'Jul', views: 312000 },
  { date: 'Aug', views: 298000 },
  { date: 'Sep', views: 345000 },
  { date: 'Oct', views: 410000 },
  { date: 'Nov', views: 378000 },
  { date: 'Dec', views: 452000 },
]

const SUBSCRIBERS_DATA = [
  { date: 'Jan', subs: 142000 },
  { date: 'Feb', subs: 156000 },
  { date: 'Mar', subs: 168000 },
  { date: 'Apr', subs: 179000 },
  { date: 'May', subs: 195000 },
  { date: 'Jun', subs: 201000 },
  { date: 'Jul', subs: 218000 },
  { date: 'Aug', subs: 234000 },
  { date: 'Sep', subs: 248000 },
  { date: 'Oct', subs: 261000 },
  { date: 'Nov', subs: 275000 },
  { date: 'Dec', subs: 291000 },
]

const RETENTION_DATA = [
  { minute: '0:00', retention: 100 },
  { minute: '0:30', retention: 87 },
  { minute: '1:00', retention: 78 },
  { minute: '1:30', retention: 68 },
  { minute: '2:00', retention: 59 },
  { minute: '2:30', retention: 52 },
  { minute: '3:00', retention: 45 },
  { minute: '3:30', retention: 39 },
  { minute: '4:00', retention: 34 },
  { minute: '4:30', retention: 30 },
  { minute: '5:00', retention: 26 },
]

const TRAFFIC_DATA = [
  { name: 'YouTube Search', value: 38, color: '#3B82F6' },
  { name: 'Suggested', value: 26, color: '#8B5CF6' },
  { name: 'External', value: 18, color: '#F97316' },
  { name: 'Direct', value: 12, color: '#10B981' },
  { name: 'Other', value: 6, color: '#94A3B8' },
]

const PERIOD_OPTIONS = ['Daily', 'Weekly', 'Monthly']

const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.06)',
  padding: '12px 16px',
  fontSize: '13px',
}

const axisTick = { fontSize: 11, fill: '#9CA3AF' }

function formatNumber(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`
  return v
}

function PeriodSelect() {
  const [period, setPeriod] = useState('Weekly')
  return (
    <select
      value={period}
      onChange={(e) => setPeriod(e.target.value)}
      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {PERIOD_OPTIONS.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}

function PrimaryCard({ title, subtitle, children, action, className = '' }) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-6 shadow-md transition-all duration-300 hover:shadow-lg ${className}`}>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function SecondaryCard({ title, subtitle, children, action, className = '' }) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${className}`}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-xs font-medium text-gray-500">{title}</h3>
          <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export default function ChartsSection() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800">Analytics Overview</h2>
        <p className="text-sm text-gray-500">Track performance trends and audience behavior</p>
      </div>

      <div className="flex flex-col gap-8 xl:flex-row">
        {/* Left — Charts (2/3) */}
        <div className="min-w-0 flex-[2] space-y-8">
          {/* PRIMARY: Views Over Time */}
          <PrimaryCard
            className="animate-fade-in-up stagger-1"
            title="Views Over Time"
            subtitle="Channel views across time periods"
            action={<PeriodSelect />}
          >
            <div className="rounded-xl bg-gradient-to-b from-blue-50/60 to-transparent p-3 -m-3 mt-0">
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={VIEWS_DATA}>
                  <defs>
                    <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.2} />
                  <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatNumber} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatNumber(v), 'Views']} />
                  <Area type="monotone" dataKey="views" stroke="#3B82F6" strokeWidth={3} fill="url(#viewsGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </PrimaryCard>

          {/* SECONDARY: Traffic Sources + Subscribers Growth */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <SecondaryCard
              className="animate-fade-in-up stagger-2"
              title="Traffic Sources"
              subtitle="Where your viewers come from"
            >
              <div className="flex items-center gap-6">
                <div className="relative" style={{ width: '50%' }}>
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={TRAFFIC_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={86}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {TRAFFIC_DATA.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} strokeWidth={0} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Total</span>
                    <span className="text-xl font-bold text-gray-800">3.39M</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  {TRAFFIC_DATA.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-gray-500">{item.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-700">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </SecondaryCard>

            <SecondaryCard
              className="animate-fade-in-up stagger-3"
              title="Subscribers Growth"
              subtitle="Net subscriber changes over time"
              action={<PeriodSelect />}
            >
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={SUBSCRIBERS_DATA}>
                  <defs>
                    <linearGradient id="subsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.2} />
                  <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatNumber} tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatNumber(v), 'Subscribers']} />
                  <Area type="monotone" dataKey="subs" stroke="#8B5CF6" strokeWidth={3} fill="url(#subsGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </SecondaryCard>
          </div>

          {/* SECONDARY: Audience Retention */}
          <SecondaryCard
            className="animate-fade-in-up stagger-4"
            title="Audience Retention"
            subtitle="Average viewer retention over video duration"
            action={<PeriodSelect />}
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={RETENTION_DATA}>
                <defs>
                  <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.2} />
                <XAxis dataKey="minute" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={axisTick} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Retention']} />
                <Area type="monotone" dataKey="retention" stroke="#10B981" strokeWidth={3} fill="url(#retGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </SecondaryCard>
        </div>

        {/* Right — Insights Panel (1/3) */}
        <div className="flex-1 xl:max-w-xs">
          <InsightsPanel />
        </div>
      </div>
    </div>
  )
}
