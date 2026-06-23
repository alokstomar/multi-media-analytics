import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, SlidersHorizontal, Download, ChevronDown,
  Bell, AlertTriangle, TrendingUp, Sparkles, CheckCircle2,
  Calendar, CheckCheck, Inbox, RefreshCw,
} from 'lucide-react'
import { usePlatformAdapter } from '../platformAdapters'
import ChannelSelector from '../components/analytics/ChannelSelector'
import { deriveAlerts } from '../utils/deriveAlerts'
import { summarizeAlerts } from '../services/api'
import { LoadingState, ErrorState, isAiUnavailable } from '../components/content-intelligence/StateShells'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'

const ALERT_TABS = [
  { key: 'all', label: 'All Alerts', color: '#3B82F6' },
  { key: 'performance', label: 'Performance', color: '#8B5CF6' },
  { key: 'audience', label: 'Audience', color: '#06B6D4' },
  { key: 'comments', label: 'Comments', color: '#F59E0B' },
  { key: 'competitors', label: 'Competitors', color: '#6366F1' },
]

export default function Alerts() {
  const {
    activeAccountId: activeChannelId,
    activeAccount: activeChannel,
    analyticsData,
    loading: isTransitioning,
  } = usePlatformAdapter()

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [readIds, setReadIds] = useState(() => new Set())
  const [dismissedIds, setDismissedIds] = useState(() => new Set())

  // AI summary state
  const [summary, setSummary] = useState(null)
  const [summaryStatus, setSummaryStatus] = useState('idle')
  const [summaryMsg, setSummaryMsg] = useState('')

  // Reset local UI state on channel switch.
  useEffect(() => {
    setReadIds(new Set())
    setDismissedIds(new Set())
  }, [activeChannelId])

  // Derive alerts deterministically from analytics — instant, no AI latency.
  const allAlerts = useMemo(
    () => deriveAlerts(analyticsData, activeChannel),
    [analyticsData, activeChannel],
  )

  const filteredAlerts = useMemo(() => {
    let result = activeTab === 'all' ? allAlerts : allAlerts.filter((a) => a.type === activeTab)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((a) =>
        a.title?.toLowerCase().includes(q) ||
        a.desc?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q),
      )
    }
    return result
      .filter((a) => !dismissedIds.has(a.id))
      .map((a) => ({ ...a, read: readIds.has(a.id) }))
  }, [allAlerts, activeTab, search, dismissedIds, readIds])

  const totalAlerts = allAlerts.length
  const unreadCount = allAlerts.filter((a) => !readIds.has(a.id)).length

  const markAllRead = useCallback(() => {
    setReadIds(new Set(allAlerts.map((a) => a.id)))
  }, [allAlerts])

  const toggleReadStatus = useCallback((id) => {
    setReadIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const dismissAlert = useCallback((id) => {
    setDismissedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  // AI summary fetch — only when we have alerts to summarize and a real channel.
  const loadSummary = useCallback(async () => {
    if (!activeChannelId || activeChannelId === 'demo' || allAlerts.length === 0) {
      setSummary(null)
      setSummaryStatus('empty')
      return
    }
    setSummaryStatus('loading')
    try {
      const analyticsSnapshot = {
        engagementRate: analyticsData?._raw?.overview?.engagementRate,
        viewsGrowth: analyticsData?._raw?.overview?.viewsGrowth,
      }
      const res = await summarizeAlerts(activeChannelId, {
        analyticsSnapshot,
        derivedAlerts: allAlerts,
      })
      const d = res?.data || res
      if (d && typeof d.summary === 'string') {
        setSummary(d)
        setSummaryStatus('idle')
      } else {
        setSummary(null)
        setSummaryStatus('empty')
      }
    } catch (err) {
      setSummary(null)
      setSummaryMsg(isAiUnavailable(err) ? 'AI service temporarily unavailable' : 'Failed to load AI summary')
      setSummaryStatus('error')
    }
  }, [activeChannelId, allAlerts, analyticsData])

  useEffect(() => {
    if (allAlerts.length === 0) {
      setSummary(null)
      setSummaryStatus('empty')
      return
    }
    loadSummary()
  }, [loadSummary, allAlerts.length])

  const isDemo = !activeChannelId || activeChannelId === 'demo'

  return (
    <div className="min-h-screen space-y-7">
      <ChannelSelector />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Alerts Center</h1>
          <p className="mt-0.5 text-sm text-gray-400">Real-time signals derived from your analytics, with AI-summarized risks and opportunities</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search alerts..." className="h-10 w-48 rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all" />
          </div>
          <button className="flex items-center gap-2 h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-500 hover:bg-gray-50 transition"><SlidersHorizontal className="h-3.5 w-3.5" />Filters</button>
          <button className="flex items-center gap-2 h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-500 hover:bg-gray-50 transition"><Calendar className="h-3.5 w-3.5" />Last 30 days<ChevronDown className="h-3 w-3" /></button>
          <button onClick={markAllRead} disabled={totalAlerts === 0} className="flex items-center gap-2 h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-500 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"><CheckCheck className="h-3.5 w-3.5" />Mark All Read</button>
          <button className="flex items-center gap-2 h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-500 hover:bg-gray-50 transition"><Download className="h-3.5 w-3.5" />Export</button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isTransitioning ? (
          <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="rounded-[20px] border border-gray-100 bg-white p-12" style={{ boxShadow: cs }}>
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mb-3" />
              <div className="h-3 w-64 bg-gray-50 rounded animate-pulse" />
            </div>
          </motion.div>
        ) : (
          <motion.div key={activeChannelId || 'empty'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="space-y-7">

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="xl:col-span-3 space-y-0">

                <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-100 mb-0">
                  {ALERT_TABS.map((t) => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                      {t.label}
                      <span className={`min-w-[20px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${activeTab === t.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                        {t.key === 'all' ? totalAlerts : allAlerts.filter((a) => a.type === t.key).length}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="rounded-[20px] border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: cs }}>
                  {isDemo ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 border border-gray-100 mb-4">
                        <Bell className="h-6 w-6 text-gray-300" />
                      </div>
                      <p className="text-sm font-bold text-gray-500">No channel connected</p>
                      <p className="text-xs text-gray-400 mt-1 max-w-md">Connect a YouTube channel above to begin tracking alerts derived from your real analytics.</p>
                    </div>
                  ) : filteredAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 border border-gray-100 mb-4">
                        <Inbox className="h-6 w-6 text-gray-300" />
                      </div>
                      <p className="text-sm font-bold text-gray-500">
                        {totalAlerts === 0 ? 'Not enough analytics yet' : 'No alerts in this category'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 max-w-md">
                        {totalAlerts === 0
                          ? 'Alerts will appear here once your channel has at least two months of analytics data.'
                          : 'Try a different tab or clear your search.'}
                      </p>
                      {totalAlerts > 0 && unreadCount > 0 && (
                        <p className="text-xs text-gray-400 mt-2">{unreadCount} unread of {totalAlerts}</p>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {filteredAlerts.map((a, i) => (
                        <motion.div
                          key={a.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25, delay: 0.2 + i * 0.04 }}
                          className={`grid grid-cols-12 gap-3 items-center px-5 py-4 hover:bg-blue-50/20 transition-colors cursor-pointer group ${!a.read ? 'bg-blue-50/10' : ''}`}
                        >
                          <div className="col-span-5 flex items-start gap-3 min-w-0">
                            <div onClick={() => toggleReadStatus(a.id)} className="relative shrink-0 mt-1 cursor-pointer" title="Toggle Read Status">
                              {!a.read && <div className="absolute -left-2.5 top-3 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-blue-100" />}
                              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-base ${a.iconBg || 'bg-gray-100'}`}>{a.icon || '🔔'}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-[13px] font-bold leading-tight ${!a.read ? 'text-gray-900' : 'text-gray-700'}`}>{a.title}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{a.desc}</p>
                            </div>
                          </div>

                          <div className="col-span-2 flex items-center gap-2 min-w-0">
                            {activeChannel?.avatar && (
                              <img src={activeChannel.avatar} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0 ring-1 ring-gray-100" />
                            )}
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-gray-600 truncate">{activeChannel?.name || 'Channel'}</p>
                              <p className="text-[10px] text-gray-300">{a.category}</p>
                            </div>
                          </div>

                          <div className="col-span-1">
                            {a.category && (
                              <span className="inline-flex rounded-full px-2 py-[3px] text-[10px] font-bold tracking-wide" style={{ backgroundColor: `${a.categoryColor}12`, color: a.categoryColor }}>{a.category}</span>
                            )}
                          </div>

                          <div className="col-span-1">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-bold capitalize ${
                              a.severity === 'positive' ? 'text-emerald-600 bg-emerald-50'
                                : a.severity === 'warning' ? 'text-amber-600 bg-amber-50'
                                : a.severity === 'high' ? 'text-red-600 bg-red-50'
                                : 'text-gray-500 bg-gray-50'
                            }`}>
                              {a.severity}
                            </span>
                          </div>

                          <div className="col-span-1">
                            <span className="text-[11px] text-gray-400">{a.time || ''}</span>
                          </div>

                          <div className="col-span-2 flex items-center justify-end gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => toggleReadStatus(a.id)} className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer" title={a.read ? 'Mark as Unread' : 'Mark as Read'}>
                              {a.read ? 'Mark Unread' : (a.cta || 'View')}
                            </button>
                            <button onClick={() => dismissAlert(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 hover:border-red-200 transition-all cursor-pointer" title="Dismiss Alert">
                              <span className="text-[12px] font-bold px-1">✕</span>
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }} className="space-y-5">
                <div className="rounded-[20px] border border-gray-100 bg-white p-5" style={{ boxShadow: cs }}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600"><Sparkles className="h-3.5 w-3.5 text-white" /></div>
                      <h3 className="text-[15px] font-bold text-gray-900">AI Smart Insights</h3>
                    </div>
                    {summaryStatus === 'error' && (
                      <button onClick={loadSummary} className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition cursor-pointer" title="Retry">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {summaryStatus === 'loading' && <LoadingState label="Summarizing risks & opportunities..." />}
                  {summaryStatus === 'error' && <ErrorState message={summaryMsg} onRetry={loadSummary} />}
                  {summaryStatus === 'empty' && (
                    <div className="py-8 text-center">
                      <Inbox className="h-6 w-6 text-gray-300 mx-auto" />
                      <p className="text-xs text-gray-400 mt-2">No insights available</p>
                      <p className="text-[10px] text-gray-300 mt-1 max-w-[220px] mx-auto">
                        AI summary appears when at least one alert can be derived from your analytics.
                      </p>
                    </div>
                  )}
                  {summaryStatus === 'idle' && summary && (
                    <div className="space-y-4">
                      <p className="text-[12px] text-gray-600 leading-relaxed font-medium">{summary.summary}</p>

                      {Array.isArray(summary.topRisks) && summary.topRisks.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Top Risks</p>
                          {summary.topRisks.map((r, i) => (
                            <div key={i} className="rounded-lg border border-red-100/60 bg-red-50/40 p-2.5">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-[11px] font-bold text-gray-800">{r.title}</p>
                                {r.severity && (
                                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                    r.severity === 'high' ? 'bg-red-100 text-red-700'
                                      : r.severity === 'medium' ? 'bg-amber-100 text-amber-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>{r.severity}</span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-500 leading-relaxed">{r.desc}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {Array.isArray(summary.topOpportunities) && summary.topOpportunities.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Top Opportunities</p>
                          {summary.topOpportunities.map((o, i) => (
                            <div key={i} className="rounded-lg border border-emerald-100/60 bg-emerald-50/40 p-2.5">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-[11px] font-bold text-gray-800">{o.title}</p>
                                {o.severity && (
                                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                    o.severity === 'high' ? 'bg-emerald-100 text-emerald-700'
                                      : o.severity === 'medium' ? 'bg-cyan-100 text-cyan-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>{o.severity}</span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-500 leading-relaxed">{o.desc}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-[20px] border border-gray-100 bg-white p-5" style={{ boxShadow: cs }}>
                  <h4 className="text-[14px] font-bold text-gray-900 mb-4">Alerts Summary</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</p>
                      <p className="text-[20px] font-bold text-gray-900 mt-0.5">{totalAlerts}</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Unread</p>
                      <p className="text-[20px] font-bold text-blue-700 mt-0.5">{unreadCount}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                      <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Warnings</p>
                      <p className="text-[20px] font-bold text-amber-700 mt-0.5">{allAlerts.filter((a) => a.severity === 'warning').length}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Positive</p>
                      <p className="text-[20px] font-bold text-emerald-700 mt-0.5">{allAlerts.filter((a) => a.severity === 'positive').length}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
