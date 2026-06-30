import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, CheckCheck, Layers, AlertCircle } from 'lucide-react'
import { useInstagramAdapter } from '../../platformAdapters/instagramAdapter'
import AccountCarousel from './AccountCarousel'
import AlertsSummary from './AlertsSummary'
import AlertsTimeline from './AlertsTimeline'
import AlertsSkeleton from './AlertsSkeleton'
import {
  getInstagramAlerts,
  refreshInstagramAlerts,
  markInstagramAlertRead,
  markAllInstagramAlertsRead,
} from '../../services/api'

/* Filter chips map directly to backend FILTER_BUCKETS. The "All" chip is a
   pass-through. Counts on chips come from the unfiltered payload so they
   don't change as the user toggles filters. */
const FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'unread', label: 'Unread' },
  { key: 'viral', label: 'Viral' },
  { key: 'growth', label: 'Growth' },
  { key: 'engagement', label: 'Engagement' },
]

const EMPTY_COUNTS = { total: 0, critical: 0, unread: 0, viral: 0 }

export default function InstagramAlerts() {
  const { accounts = [], selectedAccount, loading: adapterLoading } = useInstagramAdapter()
  const isDemo = !selectedAccount || selectedAccount.id === 'demo_ig'
  const activeAccount = isDemo ? null : selectedAccount

  // State
  const [alerts, setAlerts] = useState([])
  const [counts, setCounts] = useState(EMPTY_COUNTS)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  // Per-account scope so the page reflects whatever account the carousel has
  // active. Falls back to all-accounts when no account is selected.
  const accountId = activeAccount?.id || ''

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getInstagramAlerts({ accountId: accountId || undefined })
      setAlerts(res.alerts || [])
      setCounts(res.counts || EMPTY_COUNTS)
    } catch (err) {
      const msg =
        err.response?.data?.error || err.message || 'Failed to load Instagram alerts'
      setError(msg)
      setAlerts([])
      setCounts(EMPTY_COUNTS)
    } finally {
      setLoading(false)
    }
  }, [accountId])

  // Re-fetch on account change (and on first mount).
  useEffect(() => {
    if (!accounts.length) return
    fetchAlerts()
  }, [fetchAlerts, accounts.length])

  // Refresh handler — kicks the engine, then re-reads.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setError('')
    try {
      await refreshInstagramAlerts({ accountId: accountId || undefined })
      await fetchAlerts()
    } catch (err) {
      const msg =
        err.response?.data?.error || err.message || 'Failed to refresh Instagram alerts'
      setError(msg)
    } finally {
      setRefreshing(false)
    }
  }, [accountId, fetchAlerts])

  // Mark a single alert as read; optimistic update + server write.
  const handleMarkRead = useCallback(async (id) => {
    setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, isRead: true } : a)))
    setCounts((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }))
    try {
      await markInstagramAlertRead(id)
    } catch (err) {
      // Revert on failure
      setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, isRead: false } : a)))
      setCounts((prev) => ({ ...prev, unread: prev.unread + 1 }))
      const msg = err.response?.data?.error || 'Failed to mark alert as read'
      setError(msg)
    }
  }, [])

  // Mark all visible alerts as read.
  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true)
    const prevAlerts = alerts
    const prevCounts = counts
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })))
    setCounts((prev) => ({ ...prev, unread: 0 }))
    try {
      await markAllInstagramAlertsRead({ accountId: accountId || undefined })
    } catch (err) {
      setAlerts(prevAlerts)
      setCounts(prevCounts)
      const msg = err.response?.data?.error || 'Failed to mark all alerts as read'
      setError(msg)
    } finally {
      setMarkingAll(false)
    }
  }, [alerts, counts, accountId])

  // Filtered view of alerts for the active filter chip.
  const visibleAlerts = useMemo(() => {
    if (activeFilter === 'all') return alerts
    return alerts.filter((a) => {
      if (activeFilter === 'critical') return a.severity === 'critical'
      if (activeFilter === 'unread') return !a.isRead
      if (activeFilter === 'viral') return a.type === 'VIRAL_REEL'
      if (activeFilter === 'growth')
        return ['FOLLOWER_SPIKE', 'FOLLOWER_DROP', 'MILESTONE_REACHED'].includes(a.type)
      if (activeFilter === 'engagement')
        return (
          ['ENGAGEMENT_SPIKE', 'ENGAGEMENT_DROP', 'NEGATIVE_SENTIMENT_SURGE'].includes(a.type)
        )
      return true
    })
  }, [alerts, activeFilter])

  return (
    <div className="min-h-screen space-y-6">
      {/* Account carousel — drives the active account scope */}
      <AccountCarousel />

      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-sm">
                <Layers className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-[22px] font-bold text-gray-900 tracking-[-0.02em]">
                Instagram Alerts
              </h1>
            </div>
            {activeAccount && (
              <>
                <span className="h-5 w-px bg-gray-200" />
                <span className="text-[14px] font-medium text-gray-400">{activeAccount.name}</span>
              </>
            )}
          </div>
          <p className="mt-1 text-[13px] text-gray-400">
            Real-time signals across your Instagram accounts — growth spikes, viral reels,
            engagement drops, and more.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-800 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-purple-500' : ''}`} />
            {refreshing ? 'Detecting…' : 'Refresh'}
          </button>
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll || counts.unread === 0}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-800 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {markingAll ? 'Marking…' : 'Mark All Read'}
          </button>
        </div>
      </motion.div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-bold text-red-900">Failed to load alerts</p>
            <p className="text-[11px] text-red-700 mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => setError('')}
            className="text-red-600 hover:text-red-800 text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Body */}
      {adapterLoading && accounts.length === 0 ? (
        <AlertsSkeleton />
      ) : !activeAccount ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 border border-purple-100 mx-auto mb-4">
            <Layers className="h-6 w-6 text-purple-300" />
          </div>
          <p className="text-sm font-bold text-gray-700">No Instagram account connected</p>
          <p className="text-sm text-gray-500 mt-1">
            Connect an Instagram account to start monitoring alerts.
          </p>
        </div>
      ) : loading ? (
        <AlertsSkeleton />
      ) : (
        <>
          {/* Summary cards */}
          <AlertsSummary counts={counts} />

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {FILTER_CHIPS.map((chip) => {
              const isActive = activeFilter === chip.key
              const chipCount =
                chip.key === 'all'
                  ? counts.total
                  : chip.key === 'critical'
                  ? counts.critical
                  : chip.key === 'unread'
                  ? counts.unread
                  : chip.key === 'viral'
                  ? counts.viral
                  : visibleAlertsForBucket(alerts, chip.key).length
              return (
                <button
                  key={chip.key}
                  onClick={() => setActiveFilter(chip.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {chip.label}
                  <span
                    className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {chipCount}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Timeline */}
          <AlertsTimeline
            alerts={visibleAlerts}
            accounts={accounts}
            onMarkRead={handleMarkRead}
            activeFilter={activeFilter}
            hasAnyAlerts={alerts.length > 0}
          />
        </>
      )}
    </div>
  )
}

/* Helper: compute count for a filter bucket from the unfiltered list. Used for
   the per-chip counts on growth/engagement (which the backend doesn't return
   as separate buckets). */
function visibleAlertsForBucket(alerts, key) {
  if (key === 'growth')
    return alerts.filter((a) =>
      ['FOLLOWER_SPIKE', 'FOLLOWER_DROP', 'MILESTONE_REACHED'].includes(a.type)
    )
  if (key === 'engagement')
    return alerts.filter((a) =>
      ['ENGAGEMENT_SPIKE', 'ENGAGEMENT_DROP', 'NEGATIVE_SENTIMENT_SURGE'].includes(a.type)
    )
  return []
}
