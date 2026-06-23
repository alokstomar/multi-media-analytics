import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, SlidersHorizontal, Download, ChevronDown,
  Bell, AlertTriangle, TrendingUp, Sparkles, CheckCircle2,
  Calendar, CheckCheck,
  Inbox,
} from 'lucide-react'
import { usePlatformAdapter } from '../platformAdapters'
import ChannelSelector from '../components/analytics/ChannelSelector'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'
const iconMap = { bell: Bell, alert: AlertTriangle, trending: TrendingUp, sparkle: Sparkles, check: CheckCircle2 }

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
    loading: isTransitioning,
  } = usePlatformAdapter()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  // Until GET /api/alerts/:channelId exists, the alerts feed is empty.
  // The read/dismissed Sets below are kept as scaffolding so the future
  // fetch can drop straight into `alerts` without re-architecting the UI.
  const [readIds, setReadIds] = useState(() => new Set())
  const [dismissedIds, setDismissedIds] = useState(() => new Set())
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    setReadIds(new Set())
    setDismissedIds(new Set())
    setAlerts([])
  }, [activeChannelId])

  const filteredAlerts = (() => {
    let result = activeTab === 'all' ? alerts : alerts.filter((a) => a.type === activeTab)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(a =>
        a.title?.toLowerCase().includes(q) ||
        a.desc?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q)
      )
    }
    return result.filter((a) => !dismissedIds.has(a.id)).map((a) => ({ ...a, read: readIds.has(a.id) }))
  })()

  const markAllRead = () => {
    setReadIds(new Set(alerts.map((a) => a.id)))
  }

  const toggleReadStatus = (id) => {
    setReadIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const dismissAlert = (id) => {
    setDismissedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  const totalAlerts = alerts.length
  const unreadCount = alerts.filter(a => !readIds.has(a.id)).length

  return (
    <div className="min-h-screen space-y-7">
      <ChannelSelector />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Alerts Center</h1>
          <p className="mt-0.5 text-sm text-gray-400">AI-powered notifications, audience insights, competitor tracking & performance monitoring</p>
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
          <motion.div key={activeChannelId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="space-y-7">

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="xl:col-span-3 space-y-0">

                <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-100 mb-0">
                  {ALERT_TABS.map((t) => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                      {t.label}
                      <span className={`min-w-[20px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${activeTab === t.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                        {t.key === 'all' ? totalAlerts : alerts.filter(a => a.type === t.key).length}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="rounded-[20px] border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: cs }}>
                  {filteredAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 border border-gray-100 mb-4">
                        <Inbox className="h-6 w-6 text-gray-300" />
                      </div>
                      <p className="text-sm font-bold text-gray-500">No alerts available</p>
                      <p className="text-xs text-gray-400 mt-1 max-w-md">
                        Alerts will appear here once the backend <code className="font-mono text-[10px] bg-gray-50 px-1 py-0.5 rounded">GET /api/alerts/:channelId</code> endpoint is implemented.
                      </p>
                      {totalAlerts > 0 && unreadCount > 0 && (
                        <p className="text-xs text-gray-400 mt-2">{unreadCount} unread of {totalAlerts}</p>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {filteredAlerts.map((a, i) => {
                        const sev = a.severity || 'info'
                        return (
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
                              {a.relatedThumb && (
                                <img src={a.relatedThumb} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0 ring-1 ring-gray-100" />
                              )}
                              <div className="min-w-0">
                                <p className="text-[11px] font-medium text-gray-600 truncate">{a.relatedTitle}</p>
                                <p className="text-[10px] text-gray-300">{a.relatedMeta}</p>
                              </div>
                            </div>

                            <div className="col-span-1">
                              {a.category && (
                                <span className="inline-flex rounded-full px-2 py-[3px] text-[10px] font-bold tracking-wide" style={{ backgroundColor: `${a.categoryColor}12`, color: a.categoryColor }}>{a.category}</span>
                              )}
                            </div>

                            <div className="col-span-1">
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-bold text-gray-500 bg-gray-50 capitalize">
                                {sev}
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
                        )
                      })}
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }} className="space-y-5">
                <div className="rounded-[20px] border border-gray-100 bg-white p-5" style={{ boxShadow: cs }}>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600"><Sparkles className="h-3.5 w-3.5 text-white" /></div>
                    <h3 className="text-[15px] font-bold text-gray-900">AI Smart Insights</h3>
                  </div>

                  <div className="py-8 text-center">
                    <Inbox className="h-6 w-6 text-gray-300 mx-auto" />
                    <p className="text-xs text-gray-400 mt-2">No insights available</p>
                    <p className="text-[10px] text-gray-300 mt-1 max-w-[220px] mx-auto">
                      Insights will appear when the alerts backend is connected.
                    </p>
                  </div>
                </div>

                <div className="rounded-[20px] border border-gray-100 bg-white p-5" style={{ boxShadow: cs }}>
                  <h4 className="text-[14px] font-bold text-gray-900 mb-4">System Status</h4>
                  <div className="py-6 text-center">
                    <p className="text-xs text-gray-400">Backend alert services not yet configured</p>
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
