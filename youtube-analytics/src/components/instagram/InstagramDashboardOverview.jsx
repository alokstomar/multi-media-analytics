import { motion } from 'framer-motion'
import {
  Trash2,
  TrendingUp,
  AlertCircle,
  Info,
  Lightbulb,
  Activity,
} from 'lucide-react'
import { useInstagramAdapter } from '../../platformAdapters/instagramAdapter'
import { useState, useEffect } from 'react'
import { getInstagramRecommendations } from '../../services/api'
import AccountCarousel from './AccountCarousel'

// ── Sparkline (lightweight inline SVG, no chart lib) ──────────────────────
function Sparkline({ values, color = '#8B5CF6' }) {
  if (!values || values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100
      const y = 100 - ((v - min) / range) * 100
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-10 w-full">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────
function StatCard({ stat, index }) {
  const trendUp = stat.up
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {stat.label}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">
            {stat.value}
            {stat.unit && (
              <span className="ml-0.5 text-base font-medium text-gray-500">{stat.unit}</span>
            )}
          </p>
          <p className={`mt-1 text-xs font-semibold ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
            {trendUp ? '▲' : '▼'} {stat.trend}
          </p>
        </div>
        <div className="w-16 shrink-0 self-center">
          <Sparkline values={stat.spark} />
        </div>
      </div>
      {stat.estimated && (
        <p className="mt-2 text-[10px] text-amber-600 flex items-center gap-1">
          <Info className="h-3 w-3" /> Estimated
        </p>
      )}
    </motion.div>
  )
}

// ── Performance Chart (last 14 days, daily reach bars) ────────────────────
function PerformanceChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No performance data available.</p>
  }
  const last14 = data.slice(-14)
  const max = Math.max(...last14.map((d) => d.views || 0), 1)
  return (
    <div className="flex items-end gap-1.5 h-40">
      {last14.map((d, i) => {
        const v = d.views || 0
        const heightPct = (v / max) * 100
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-1 group relative"
            title={`${d.date}: ${v.toLocaleString()} reach`}
          >
            <div className="w-full flex items-end" style={{ height: '100%' }}>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-purple-500 to-purple-300 transition-all duration-300 group-hover:from-purple-600 group-hover:to-purple-400"
                style={{ height: `${Math.max(heightPct, 2)}%`, minHeight: '3px' }}
              />
            </div>
            <span className="text-[9px] text-gray-400 font-medium">
              {d.date?.split(' ')[1] || ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── AI Insight Card ───────────────────────────────────────────────────────
const INSIGHT_STYLES = {
  positive: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', Icon: TrendingUp },
  warning: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', Icon: AlertCircle },
  info: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', Icon: Info },
}

function InsightCard({ insight, index }) {
  const style = INSIGHT_STYLES[insight.type] || INSIGHT_STYLES.info
  const { Icon } = style
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.07, 0.5) }}
      className={`rounded-2xl border ${style.border} ${style.bg} p-5`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-white ${style.text} shadow-sm shrink-0`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">{insight.title}</p>
          <p className="mt-1 text-xs text-gray-600 leading-relaxed">{insight.desc}</p>
          <p className="mt-2 text-xs font-semibold text-gray-800 flex items-start gap-1">
            <Lightbulb className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
            <span>{insight.action}</span>
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ── Source Distribution Bar ───────────────────────────────────────────────
function SourceBar({ source }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-gray-600 font-medium flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: source.color }} />
          {source.name}
        </span>
        <span className="text-gray-500 tabular-nums">{source.value}%</span>
      </div>
      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${source.value}%`, backgroundColor: source.color }}
        />
      </div>
    </div>
  )
}

// ── Distribution Card with proper empty state ─────────────────────────────
function DistributionCard({ title, sources }) {
  const hasData = sources && sources.length > 0
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900 mb-4">{title}</h3>
      {hasData ? (
        <div className="space-y-3">
          {sources.map((s) => (
            <SourceBar key={s.name} source={s} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 py-6 text-center">No analytics available.</p>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────
export default function InstagramDashboardOverview() {
  const {
    accounts = [],
    selectedAccount,
    analyticsData,
    loading,
    error,
    removeAccount,
  } = useInstagramAdapter()

  const isDemo = !selectedAccount || selectedAccount.id === 'demo_ig'
  const activeAccount = isDemo ? null : selectedAccount
  const hasOverview = !!analyticsData?._raw?.overview

  const [aiInsights, setAiInsights] = useState([])
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (!activeAccount?.id || !hasOverview) {
      setAiInsights([])
      return
    }
    let isMounted = true
    setAiLoading(true)
    getInstagramRecommendations(activeAccount.id)
      .then((res) => {
        if (!isMounted) return
        const recs = res?.recommendations || []
        const mapped = recs.slice(0, 3).map((r) => ({
          title: r.title,
          desc: r.rationale,
          action: `Category: ${r.category} · Impact: ${r.impact}`,
          type: r.impact === 'High' ? 'positive' : r.impact === 'Medium' ? 'info' : 'warning',
        }))
        setAiInsights(mapped)
      })
      .catch(() => {
        if (isMounted) setAiInsights([])
      })
      .finally(() => {
        if (isMounted) setAiLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [activeAccount?.id, hasOverview])

  const stats = analyticsData?.analyticsStats || []
  const performance = analyticsData?.performanceData || []
  const trafficSources = analyticsData?.trafficSources || []
  const devices = analyticsData?.devices || []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Instagram Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              {activeAccount
                ? `Overview of ${activeAccount.name}'s performance.`
                : 'Overview of your Instagram performance.'}
            </p>
          </div>
          {activeAccount && (
            <button
              onClick={async () => {
                if (window.confirm(`Disconnect ${activeAccount.name}?`)) {
                  try {
                    await removeAccount(activeAccount.id)
                  } catch (err) {
                    alert('Failed to disconnect account')
                  }
                }
              }}
              className="self-start sm:self-center flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-50 cursor-pointer transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Disconnect Account
            </button>
          )}
        </div>

        {/* Connected Accounts carousel + connect affordance (IG-isolated) */}
        <AccountCarousel />

        <div className="border-t border-gray-100" />

        {/* Body */}
        {loading && accounts.length === 0 ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-gray-200 rounded-2xl" />
            <div className="h-24 bg-gray-200 rounded-2xl" />
            <div className="h-24 bg-gray-200 rounded-2xl" />
          </div>
        ) : !activeAccount ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-lg font-medium">No connected Instagram account</p>
            <p className="text-sm mt-1">
              Connect an Instagram account above to start analyzing metrics.
            </p>
          </div>
        ) : !hasOverview ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-2 max-w-xl mx-auto">
            <p className="text-lg font-medium text-gray-700">
              {error
                ? 'Failed to load analytics'
                : selectedAccount?.syncStatus === 'syncing'
                ? 'Analytics are still syncing'
                : selectedAccount?.syncStatus === 'error'
                ? 'Sync failed'
                : 'No Instagram analytics available'}
            </p>
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : selectedAccount?.syncStatus === 'syncing' ? (
              <p className="text-sm text-gray-500">
                Analytics are still syncing. Initial Instagram data is being fetched from RapidAPI.
              </p>
            ) : selectedAccount?.syncStatus === 'error' ? (
              <p className="text-sm text-gray-500">
                Unable to synchronize this Instagram account. Please try syncing again.
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                No analytics available yet. The initial synchronization has not completed.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, i) => (
                <StatCard key={stat.label} stat={stat} index={i} />
              ))}
            </div>

            {/* Performance Chart */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-purple-500" />
                    Daily Reach (last 14 days)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Reach mapped to chart axis; impressions available in detailed analytics.
                  </p>
                </div>
              </div>
              <PerformanceChart data={performance} />
            </div>

            {/* AI Insights */}
            {aiInsights.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  AI Insights
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {aiInsights.map((insight, i) => (
                    <InsightCard key={i} insight={insight} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Traffic Sources + Devices — real data only. Cards render their
                own empty state when the backend has not yet provided values. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DistributionCard title="Traffic Sources" sources={trafficSources} />
              <DistributionCard title="Devices" sources={devices} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
