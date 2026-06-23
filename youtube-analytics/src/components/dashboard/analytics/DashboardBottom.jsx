import { useState, useEffect, useCallback } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { LineChart, Line, Area, XAxis, YAxis, Tooltip } from "recharts"
import { getInsights, getStrategistTips } from '../../../services/api'
import { CardSkeleton, ErrorBanner } from '../../ui/Skeleton'
import { usePlatform } from '../../../hooks/usePlatform'
import { usePlatformAdapter } from '../../../platformAdapters'

const DEFAULT_TRAFFIC = [
  { name: "YouTube Search", value: 45.2, color: "#3B82F6" },
  { name: "Browse Features", value: 28.4, color: "#8B5CF6" },
  { name: "Suggested Videos", value: 15.6, color: "#EF4444" },
  { name: "External", value: 7.2, color: "#F59E0B" },
  { name: "Others", value: 3.6, color: "#10B981" },
]

const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: "10px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  fontSize: "12px",
}

function formatNum(v) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

const INSIGHT_COLORS = {
  positive: { bg: 'bg-green-50', border: 'border-green-100', iconBg: 'bg-green-100', iconColor: 'text-green-600', titleColor: 'text-green-700', btnColor: 'text-green-600 hover:text-green-800' },
  info: { bg: 'bg-blue-50', border: 'border-blue-100', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', titleColor: 'text-blue-700', btnColor: 'text-blue-600 hover:text-blue-800' },
  warning: { bg: 'bg-orange-50', border: 'border-orange-100', iconBg: 'bg-orange-100', iconColor: 'text-orange-600', titleColor: 'text-orange-700', btnColor: 'text-orange-600 hover:text-orange-800' },
}

function AIInsightsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse bg-gray-50 border border-gray-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-gray-200" />
            <div className="flex-1">
              <div className="h-3 w-3/4 rounded bg-gray-200 mb-2" />
              <div className="h-2.5 w-1/2 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center h-full">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400 mb-3">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500 mt-1 max-w-[200px]">{description}</p>
    </div>
  )
}

export default function DashboardBottom({ trafficSources, subscribersGrowth, overview, channelId, loading: parentLoading, overrideInsights }) {
  const [insights, setInsights] = useState([])
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [insightsError, setInsightsError] = useState(false)
  const { selectedPlatform } = usePlatform()

  const {
    selectedAccount: selectedChannel,
    accounts: channels,
    loading: loadingChannels
  } = usePlatformAdapter()

  const channel =
    selectedChannel ||
    channels?.[0] ||
    null

  const normalizedChannel = channel
    ? {
        ...channel,
        resolvedId:
          channel.channelId ||
          channel.id ||
          channel._id ||
          null
      }
    : null

  if (import.meta.env.DEV) {
    console.log({
      selectedChannel,
      channels,
      normalizedChannel
    })
  }

  const loadInsights = useCallback(async (resolvedChannelId) => {
    setInsightsLoading(true)
    setInsightsError(false)
    try {
      const res = await getInsights(resolvedChannelId)
      const primary = Array.isArray(res?.data) ? res.data : []
      if (primary.length > 0) {
        setInsights(primary)
        return
      }
      try {
        const tipsRes = await getStrategistTips(resolvedChannelId)
        const tips = tipsRes?.data?.tips || tipsRes?.tips || []
        const mapped = tips.map((t) => ({
          type: t.severity === 'warning' ? 'warning'
            : t.severity === 'positive' ? 'positive'
            : 'info',
          title: t.title || t.heading || 'AI Insight',
          description: t.desc || t.description || t.body || '',
          action: t.cta || 'Review',
        }))
        setInsights(mapped)
      } catch (fallbackErr) {
        setInsightsError(true)
        setInsights([])
      }
    } catch (err) {
      try {
        const tipsRes = await getStrategistTips(resolvedChannelId)
        const tips = tipsRes?.data?.tips || tipsRes?.tips || []
        const mapped = tips.map((t) => ({
          type: t.severity === 'warning' ? 'warning'
            : t.severity === 'positive' ? 'positive'
            : 'info',
          title: t.title || t.heading || 'AI Insight',
          description: t.desc || t.description || t.body || '',
          action: t.cta || 'Review',
        }))
        setInsights(mapped)
      } catch (fallbackErr) {
        setInsightsError(true)
        setInsights([])
      }
    } finally {
      setInsightsLoading(false)
    }
  }, [])

  useEffect(() => {
    const shouldUseOverride =
      Array.isArray(overrideInsights) &&
      overrideInsights.length > 0

    if (shouldUseOverride) {
      setInsights(overrideInsights)
      setInsightsLoading(false)
      setInsightsError(false)
      return
    }

    if (overrideInsights === null || overrideInsights === undefined) {
      const resolvedChannelId = normalizedChannel?.resolvedId
      if (!resolvedChannelId) {
        setInsightsLoading(false)
        return
      }
      loadInsights(resolvedChannelId)
    } else {
      setInsights(overrideInsights || [])
      setInsightsLoading(false)
    }
  }, [normalizedChannel?.resolvedId, overrideInsights, loadInsights])

  const trafficData = trafficSources?.length ? trafficSources : DEFAULT_TRAFFIC
  const subsData = (subscribersGrowth || []).map((s) => ({
    name: s.date,
    value: s.subscribers >= 1_000_000
      ? parseFloat((s.subscribers / 1_000_000).toFixed(2))
      : parseFloat((s.subscribers / 1_000).toFixed(0)),
  }))
  const subsUnit = overview?.subscribers >= 1_000_000 ? 'M' : 'K'

  if (parentLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">

      {/* ===== TRAFFIC SOURCES ===== */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col transition-all duration-300 hover:shadow-md">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">Traffic Sources</h2>
          <div className="flex items-center gap-2 text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
            </svg>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-5">Where your {selectedPlatform === 'instagram' ? 'reach' : 'views'} comes from</p>

        <div className="flex items-center gap-6 flex-1">
          <div className="relative w-40 h-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={trafficData}
                  dataKey="value"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {trafficData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-900">
                {formatNum(selectedPlatform === 'instagram' ? (overview?.reach || 0) : (overview?.totalViews || 0))}
              </span>
              <span className="text-xs text-gray-400">{selectedPlatform === 'instagram' ? 'Total Reach' : 'Total Views'}</span>
            </div>
          </div>

          <div className="flex-1 space-y-2.5">
            {trafficData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-gray-700">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-800">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-100">
            <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-700">
              {trafficData[0]?.name || (selectedPlatform === 'instagram' ? 'Instagram Explore' : 'YouTube Search')} is your top traffic source
            </p>
            <p className="text-xs text-green-600 font-medium">
              +{selectedPlatform === 'instagram' ? (overview?.reachGrowth || 0).toFixed(0) : (overview?.viewsGrowth || 0).toFixed(0)}% vs last period
            </p>
          </div>
        </div>
      </div>

      {/* ===== SUBSCRIBERS GROWTH ===== */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col transition-all duration-300 hover:shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            {selectedPlatform === 'instagram' ? 'Followers Growth' : 'Subscribers Growth'}
          </h2>
          <select className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500 focus:outline-none">
            <option>Daily</option>
            <option>Weekly</option>
            <option>Monthly</option>
          </select>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-500">
            {selectedPlatform === 'instagram' ? 'Total Followers' : 'Total Subscribers'}
          </p>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-3xl font-bold text-gray-900">{formatNum(overview?.subscribers || 0)}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              (overview?.viewsGrowth || 0) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d={(overview?.viewsGrowth || 0) >= 0 ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
              </svg>
              +{(overview?.engagementRate || 0).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="flex-1">
          {subsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={subsData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="subsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} domain={['auto', 'auto']} tickCount={5} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="value" fill="url(#subsGrad)" stroke={false} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8B5CF6"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#fff", strokeWidth: 2.5, stroke: "#8B5CF6" }}
                  activeDot={{ r: 7, stroke: "#8B5CF6", strokeWidth: 2, fill: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">
              No subscriber data
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-3 border-t border-gray-50 pt-4">
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100">
                <svg className="h-3.5 w-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-bold text-gray-900">{formatNum(selectedPlatform === 'instagram' ? (overview?.followers || 0) : (overview?.subscribers || 0))}</p>
            <p className="text-[11px] text-gray-400">Total</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-100">
                <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-bold text-green-600">
              +{selectedPlatform === 'instagram' ? (overview?.followersGrowth || 0).toFixed(1) : (overview?.viewsGrowth || 0).toFixed(1)}%
            </p>
            <p className="text-[11px] text-gray-400">Growth</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100">
                <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-bold text-gray-900">{formatNum(selectedPlatform === 'instagram' ? (overview?.reach || 0) : (overview?.averageViews || 0))}</p>
            <p className="text-[11px] text-gray-400">{selectedPlatform === 'instagram' ? 'Total Reach' : 'Avg Views'}</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-100">
                <svg className="h-3.5 w-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-bold text-gray-900">{(overview?.engagementRate || 0).toFixed(1)}%</p>
            <p className="text-[11px] text-gray-400">Engagement</p>
          </div>
        </div>
      </div>

      {/* ===== AI INSIGHTS ===== */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col transition-all duration-300 hover:shadow-md">
        <div className="flex items-center gap-2 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100">
            <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">AI Insights</h2>
        </div>

        <div className="flex-1 space-y-3">
          {(() => {
            if (loadingChannels) {
              return <AIInsightsSkeleton />
            }

            const hasAnyChannel = !!normalizedChannel || (Array.isArray(channels) && channels.length > 0)

            if (!hasAnyChannel) {
              return (
                <EmptyState
                  title="No channel connected"
                  description="Connect a YouTube channel to see AI insights"
                />
              )
            }

            if (insightsLoading) {
              return <AIInsightsSkeleton />
            }

            if (insightsError) {
              return (
                <div className="space-y-3">
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                    <p className="text-sm font-semibold text-red-700">Couldn't load AI insights</p>
                    <p className="text-xs text-red-600 mt-1">The AI service may be warming up. Try again in a moment.</p>
                  </div>
                  <button
                    onClick={() => normalizedChannel?.resolvedId && loadInsights(normalizedChannel.resolvedId)}
                    className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry
                  </button>
                </div>
              )
            }

            if (!insights?.length) {
              return (
                <EmptyState
                  title="No insights yet"
                  description="Insights are still being generated for this channel — check back shortly."
                />
              )
            }

            return insights.slice(0, 3).map((insight, i) => {
              const c = INSIGHT_COLORS[insight?.type] || INSIGHT_COLORS.info
              return (
                <div key={i} className={`${c.bg} border ${c.border} rounded-xl p-4 transition-all duration-200 hover:scale-[1.01]`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.iconBg}`}>
                      <svg className={`h-4 w-4 ${c.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {insight?.type === 'positive' && <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />}
                        {insight?.type === 'info' && <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
                        {insight?.type === 'warning' && <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />}
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${c.titleColor}`}>{insight?.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {insight?.description || insight?.desc || 'No description available'}
                      </p>
                      <button className={`mt-2 text-xs font-semibold ${c.btnColor} transition-colors`}>
                        {insight?.action || 'Review'} &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          })()}
        </div>
      </div>
    </div>
  )
}
