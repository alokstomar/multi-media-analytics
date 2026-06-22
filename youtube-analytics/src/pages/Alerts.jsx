import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, SlidersHorizontal, Download, ChevronDown, ChevronRight,
  Bell, AlertTriangle, TrendingUp, Sparkles, CheckCircle2,
  MoreHorizontal, Calendar, CheckCheck, ArrowUpRight,
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { usePlatformAdapter } from '../platformAdapters'
import { usePlatform } from '../context/PlatformContext'
import ChannelSelector from '../components/analytics/ChannelSelector'
import { fmt } from '../utils/format'

const cs = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'
const iconMap = { bell: Bell, alert: AlertTriangle, trending: TrendingUp, sparkle: Sparkles, check: CheckCircle2 }

const ALERT_TABS = [
  { key: 'all', label: 'All Alerts', color: '#3B82F6' },
  { key: 'performance', label: 'Performance', color: '#8B5CF6' },
  { key: 'audience', label: 'Audience', color: '#06B6D4' },
  { key: 'comments', label: 'Comments', color: '#F59E0B' },
  { key: 'competitors', label: 'Competitors', color: '#6366F1' },
]

const SEVERITY = {
  critical: { label: 'Critical', bg: 'bg-red-50', text: 'text-red-600', dot: '#EF4444' },
  high: { label: 'High', bg: 'bg-orange-50', text: 'text-orange-600', dot: '#F97316' },
  medium: { label: 'Medium', bg: 'bg-amber-50', text: 'text-amber-600', dot: '#F59E0B' },
  low: { label: 'Low', bg: 'bg-blue-50', text: 'text-blue-600', dot: '#3B82F6' },
  info: { label: 'Info', bg: 'bg-gray-50', text: 'text-gray-500', dot: '#9CA3AF' },
}

export default function Alerts() {
  const { selectedPlatform } = usePlatform()
  const {
    activeAccountId: activeChannelId,
    loading: isTransitioning,
    analyticsData: channelData,
    activeAccount: activeChannel
  } = usePlatformAdapter()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [visibleCount, setVisibleCount] = useState(4)

  // Read/dismissed state tracked separately as Sets — avoids mirroring the
  // derived `allAlerts` array into useState (which caused the React #185 loop).
  const [readIds, setReadIds] = useState(() => new Set())
  const [dismissedIds, setDismissedIds] = useState(() => new Set())

  const overview = channelData?._raw?.overview || {}
  // Extract primitive values up front so useMemo deps below can be primitives
  // (the whole `channelData` / `overview` objects are unstable references and
  // would re-fire the memo every render).
  const viewsGrowth = overview.viewsGrowth || overview.reachGrowth || 0
  const engagementRate = overview.engagementRate || 0
  const subscribers = overview.subscribers || overview.followers || 0
  const topVideos = channelData?._raw?.topVideos || channelData?._raw?.posts || []
  // Stable string signature of topVideos so the memo dep changes only when the
  // underlying content changes — not on every render due to a new array ref.
  const topVideosSig = JSON.stringify(topVideos?.map((v) => ({
    t: v?.title || v?.caption || '',
    x: v?.views || v?.reach || 0,
    th: v?.thumbnail || '',
  })))

  // Generate alerts from insights and analytics data.
  // Deps are primitives only — never the whole `channelData` object.
  const allAlerts = useMemo(() => {
    const growth = viewsGrowth
    const eng = engagementRate
    const subs = subscribers
    const topVids = topVideos

    const generated = []
    const metricName = selectedPlatform === 'instagram' ? 'Reach' : 'Views'

    // 1. Views spike/decline (Performance category)
    if (growth > 10) {
      const relatedVideo = topVids[0] || {}
      generated.push({
        id: 1,
        read: false,
        type: 'performance',
        icon: '📈',
        iconBg: 'bg-emerald-100',
        title: `${metricName} spike detected`,
        desc: `${metricName} increased +${growth.toFixed(1)}% — check which ${selectedPlatform === 'instagram' ? 'posts' : 'videos'} are driving this spike.`,
        relatedTitle: relatedVideo.title || relatedVideo.caption || 'Latest Upload',
        relatedMeta: relatedVideo.views ? `${fmt(relatedVideo.views)} views` : (relatedVideo.reach ? `${fmt(relatedVideo.reach)} reach` : 'Performance'),
        relatedThumb: relatedVideo.thumbnail || null,
        category: 'Performance',
        categoryColor: '#10B981',
        severity: 'info',
        time: '2h ago',
        cta: 'View Details',
      })
    } else if (growth < -5) {
      const relatedVideo = topVids[0] || {}
      generated.push({
        id: 1,
        read: false,
        type: 'performance',
        icon: '📉',
        iconBg: 'bg-red-100',
        title: `${metricName} declining`,
        desc: `${metricName} dropped ${Math.abs(growth).toFixed(1)}% — consider optimizing hooks or checking search terms.`,
        relatedTitle: relatedVideo.title || relatedVideo.caption || 'Account overview',
        relatedMeta: 'Analytics',
        relatedThumb: relatedVideo.thumbnail || null,
        category: 'Performance',
        categoryColor: '#EF4444',
        severity: 'warning',
        time: '4h ago',
        cta: 'Optimize',
      })
    }

    // 2. High engagement / Audience love (Audience category)
    if (eng > 3) {
      const relatedVideo = topVids[1] || topVids[0] || {}
      generated.push({
        id: 2,
        read: false,
        type: 'audience',
        icon: '🔥',
        iconBg: 'bg-orange-100',
        title: 'High engagement detected',
        desc: `Engagement rate is ${eng.toFixed(1)}% — audience is extremely active and commenting!`,
        relatedTitle: relatedVideo.title || relatedVideo.caption || 'Engagement report',
        relatedMeta: 'Analytics',
        relatedThumb: relatedVideo.thumbnail || null,
        category: 'Audience',
        categoryColor: '#3B82F6',
        severity: 'info',
        time: '6h ago',
        cta: 'View Report',
      })
    }

    // 3. Weekly digest ready (System category)
    generated.push({
      id: 3,
      read: true,
      type: 'system',
      icon: '📊',
      iconBg: 'bg-blue-100',
      title: 'Weekly digest ready',
      desc: `Weekly analytics summary is ready based on ${fmt(subs)} total ${selectedPlatform === 'instagram' ? 'followers' : 'subscribers'} & active uploads.`,
      relatedTitle: 'Weekly report',
      relatedMeta: 'Reports',
      relatedThumb: topVids[2]?.thumbnail || null,
      category: 'System',
      categoryColor: '#6B7280',
      severity: 'info',
      time: '1d ago',
      cta: 'View Report',
    })

    // 4. Milestone Alert (Audience category)
    if (subs > 0) {
      generated.push({
        id: 4,
        read: true,
        type: 'audience',
        icon: '🎉',
        iconBg: 'bg-purple-100',
        title: `New ${selectedPlatform === 'instagram' ? 'follower' : 'subscriber'} milestone`,
        desc: `${selectedPlatform === 'instagram' ? 'Account' : 'Channel'} successfully reached ${fmt(subs)} ${selectedPlatform === 'instagram' ? 'followers' : 'subscribers'}!`,
        relatedTitle: `${selectedPlatform === 'instagram' ? 'Follower' : 'Subscriber'} growth`,
        relatedMeta: 'Audience',
        relatedThumb: topVids[3]?.thumbnail || null,
        category: 'Audience',
        categoryColor: '#8B5CF6',
        severity: 'info',
        time: '2d ago',
        cta: 'Celebrate',
      })
    }

    // 5. Upload reminder (Performance/Schedule category)
    const lastVideo = topVids[topVids.length - 1] || topVids[0] || {}
    generated.push({
      id: 5,
      read: true,
      type: 'performance',
      icon: '📅',
      iconBg: 'bg-amber-100',
      title: `${selectedPlatform === 'instagram' ? 'Post' : 'Upload'} reminder`,
      desc: `No new ${selectedPlatform === 'instagram' ? 'post' : 'video'} in the last 7 days — maintain your schedule to keep the algorithm recommending your content.`,
      relatedTitle: lastVideo.title || lastVideo.caption || 'Content calendar',
      relatedMeta: 'Schedule',
      relatedThumb: lastVideo.thumbnail || null,
      category: 'Performance',
      categoryColor: '#F59E0B',
      severity: 'warning',
      time: '3d ago',
      cta: 'Plan Content',
    })

    return generated
  }, [viewsGrowth, engagementRate, subscribers, topVideosSig, selectedPlatform, activeChannelId])

  // Reset read/dismissed state when active channel changes — but DO NOT mirror
  // allAlerts into useState (that was the React #185 recursive loop).
  useEffect(() => {
    setReadIds(new Set())
    setDismissedIds(new Set())
    setVisibleCount(4)
  }, [activeChannelId])

  const markAllRead = () => {
    setReadIds(new Set(allAlerts.map((a) => a.id)))
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

  // Derive the working `alerts` list directly from allAlerts + Sets — pure render.
  const alerts = useMemo(
    () => allAlerts
      .filter((a) => !dismissedIds.has(a.id))
      .map((a) => ({ ...a, read: readIds.has(a.id) })),
    [allAlerts, readIds, dismissedIds]
  )

  // Generate alert stats from analytics
  const stats = useMemo(() => {
    const totalCount = alerts.length
    const criticalCount = alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length
    const perfCount = alerts.filter(a => a.type === 'performance').length
    const resolvedCount = alerts.filter(a => a.read).length
    const aiCount = channelData?.aiInsights?.length || 5

    return [
      { label: 'Total Alerts', value: String(totalCount), color: '#3B82F6', icon: 'bell', spark: [8, 12, 10, 16, 14, 20, totalCount], trend: '+18%', up: true },
      { label: 'Critical', value: String(criticalCount), color: '#EF4444', icon: 'alert', spark: [1, 2, 1, 3, 2, 2, criticalCount], trend: '-12%', up: true },
      { label: 'Performance', value: String(perfCount), color: '#F59E0B', icon: 'trending', spark: [3, 5, 4, 6, 7, 8, perfCount], trend: '+5%', up: true },
      { label: 'AI Insights', value: String(aiCount), color: '#8B5CF6', icon: 'sparkle', spark: [2, 4, 3, 5, 6, 5, aiCount], trend: '+10%', up: true },
      { label: 'Resolved', value: String(resolvedCount), color: '#10B981', icon: 'check', spark: [6, 8, 10, 12, 14, 16, resolvedCount], trend: '+22%', up: true },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, channelData?.aiInsights?.length])

  const filteredAlerts = useMemo(() => {
    let result = activeTab === 'all' ? alerts : alerts.filter((a) => a.type === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.title?.toLowerCase().includes(q) ||
        a.desc?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [alerts, activeTab, search])

  const visibleAlerts = useMemo(() => {
    return filteredAlerts.slice(0, visibleCount)
  }, [filteredAlerts, visibleCount])

  const growth = overview.viewsGrowth || overview.reachGrowth || 0
  const eng = overview.engagementRate || 0

  const aiInsights = useMemo(() => {
    return [
      { title: 'Smart Alert Summary', desc: `${allAlerts.length} alerts generated from analytics data`, bg: 'bg-blue-50', textColor: 'text-blue-800', color: '#3B82F6', badge: 'AI' },
      { title: 'Growth Pattern', desc: growth >= 0 ? 'Positive growth trend detected' : 'Growth dip — review content strategy', bg: growth >= 0 ? 'bg-emerald-50' : 'bg-amber-50', textColor: growth >= 0 ? 'text-emerald-800' : 'text-amber-800', color: growth >= 0 ? '#10B981' : '#F59E0B' },
      { title: 'Engagement Alert', desc: eng >= 3 ? 'Strong engagement metrics' : (selectedPlatform === 'instagram' ? 'Consider optimizing hook slides or Reels audio' : 'Consider optimizing video hooks'), bg: 'bg-violet-50', textColor: 'text-violet-800', color: '#8B5CF6' },
      { title: 'Content Recommendation', desc: 'Post during peak hours for maximum reach', bg: 'bg-blue-50', textColor: 'text-blue-800', color: '#3B82F6' },
      { title: 'Audience Insight', desc: `${selectedPlatform === 'instagram' ? 'Follower' : 'Subscriber'} growth consistent with upload frequency`, bg: 'bg-emerald-50', textColor: 'text-emerald-800', color: '#10B981' },
    ]
  }, [allAlerts, growth, eng, selectedPlatform])

  /* Skeleton */
  const Skel = () => (
    <div className="space-y-7 animate-pulse">
      <div className="grid grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-[20px] bg-white p-5 border border-gray-100"><div className="h-3 w-20 bg-gray-200 rounded mb-3" /><div className="h-7 w-14 bg-gray-200 rounded mb-3" /><div className="h-8 bg-gray-100 rounded" /></div>
      ))}</div>
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 rounded-[20px] bg-white p-6 border border-gray-100">
          {Array.from({ length: 6 }).map((_, i) => (<div key={i} className="flex items-center gap-4 py-4 border-b border-gray-50"><div className="h-10 w-10 bg-gray-200 rounded-2xl" /><div className="flex-1"><div className="h-4 w-2/3 bg-gray-200 rounded mb-2" /><div className="h-3 w-full bg-gray-100 rounded" /></div><div className="h-8 w-20 bg-gray-200 rounded-lg" /></div>))}
        </div>
        <div className="rounded-[20px] bg-white p-6 border border-gray-100">{Array.from({ length: 6 }).map((_, i) => (<div key={i} className="rounded-xl bg-gray-50 p-4 mb-3"><div className="h-3.5 w-2/3 bg-gray-200 rounded mb-2" /><div className="h-3 w-full bg-gray-100 rounded" /></div>))}</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen space-y-7">
      <ChannelSelector />

      {/* ── Header ─────────────────────────────────────── */}
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
          <button onClick={markAllRead} className="flex items-center gap-2 h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-500 hover:bg-gray-50 transition cursor-pointer"><CheckCheck className="h-3.5 w-3.5" />Mark All Read</button>
          <button className="flex items-center gap-2 h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-500 hover:bg-gray-50 transition"><Download className="h-3.5 w-3.5" />Export</button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isTransitioning ? (
          <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Skel /></motion.div>
        ) : (
          <motion.div key={activeChannelId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="space-y-7">

            {/* ── Metric Cards ─────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {stats.map((s, i) => {
                const Icon = iconMap[s.icon] || Bell
                const spark = s.spark.map((v) => ({ v }))
                return (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }} className="rounded-[20px] border border-gray-100 bg-white p-5 hover:shadow-md transition-all duration-300" style={{ boxShadow: cs }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${s.color}10` }}><Icon className="h-4 w-4" style={{ color: s.color }} /></div>
                    </div>
                    <p className="text-[12px] font-medium text-gray-400 tracking-wide mb-1">{s.label}</p>
                    <p className="text-[22px] font-bold text-gray-900 tracking-tight leading-none mb-1">{s.value}</p>
                    <div className="h-[32px] -mx-1 mb-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={spark} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                          <defs><linearGradient id={`as-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity={0.2} /><stop offset="100%" stopColor={s.color} stopOpacity={0} /></linearGradient></defs>
                          <Area type="monotone" dataKey="v" stroke={s.color} strokeWidth={2} fill={`url(#as-${i})`} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${s.up ? 'text-emerald-600' : 'text-red-500'}`}><TrendingUp className="h-3 w-3" />{s.trend}</span>
                      <span className="text-[11px] text-gray-300">vs last 30 days</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* ── Tabs + Alerts + Sidebar ──────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

              {/* Left: Tabs + List */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="xl:col-span-3 space-y-0">

                {/* Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-100 mb-0">
                  {ALERT_TABS.map((t) => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                      {t.label}
                      <span className={`min-w-[20px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${activeTab === t.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                        {t.key === 'all' ? alerts.length : alerts.filter(a => a.type === t.key).length}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Alerts feed */}
                <div className="rounded-[20px] border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: cs }}>
                  <div className="divide-y divide-gray-50">
                    {visibleAlerts.map((a, i) => {
                      const sev = SEVERITY[a.severity] || SEVERITY.info
                      return (
                        <motion.div
                          key={a.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25, delay: 0.2 + i * 0.04 }}
                          className={`grid grid-cols-12 gap-3 items-center px-5 py-4 hover:bg-blue-50/20 transition-colors cursor-pointer group ${!a.read ? 'bg-blue-50/10' : ''}`}
                        >
                          {/* Icon + Alert info */}
                          <div className="col-span-5 flex items-start gap-3 min-w-0">
                            {/* Unread dot */}
                            <div onClick={() => toggleReadStatus(a.id)} className="relative shrink-0 mt-1 cursor-pointer" title="Toggle Read Status">
                              {!a.read && <div className="absolute -left-2.5 top-3 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-blue-100" />}
                              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-base ${a.iconBg}`}>{a.icon}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-[13px] font-bold leading-tight ${!a.read ? 'text-gray-900' : 'text-gray-700'}`}>{a.title}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{a.desc}</p>
                            </div>
                          </div>

                          {/* Related context */}
                          <div className="col-span-2 flex items-center gap-2 min-w-0">
                            {a.relatedThumb && (
                              <img src={a.relatedThumb} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0 ring-1 ring-gray-100" />
                            )}
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-gray-600 truncate">{a.relatedTitle}</p>
                              <p className="text-[10px] text-gray-300">{a.relatedMeta}</p>
                            </div>
                          </div>

                          {/* Category */}
                          <div className="col-span-1">
                            <span className="inline-flex rounded-full px-2 py-[3px] text-[10px] font-bold tracking-wide" style={{ backgroundColor: `${a.categoryColor}12`, color: a.categoryColor }}>{a.category}</span>
                          </div>

                          {/* Severity */}
                          <div className="col-span-1">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-bold ${sev.bg} ${sev.text}`}>
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sev.dot }} />
                              {sev.label}
                            </span>
                          </div>

                          {/* Time */}
                          <div className="col-span-1">
                            <span className="text-[11px] text-gray-400">{a.time}</span>
                          </div>

                          {/* Action */}
                          <div className="col-span-2 flex items-center justify-end gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => toggleReadStatus(a.id)} className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer" title={a.read ? 'Mark as Unread' : 'Mark as Read'}>
                              {a.read ? 'Mark Unread' : a.cta}
                            </button>
                            <button onClick={() => dismissAlert(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 hover:border-red-200 transition-all cursor-pointer" title="Dismiss Alert">
                              <span className="text-[12px] font-bold px-1">✕</span>
                            </button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>

                  {/* Load more */}
                  {filteredAlerts.length > visibleCount && (
                    <div className="flex justify-center py-4 border-t border-gray-50">
                      <button
                        onClick={() => setVisibleCount(prev => prev + 4)}
                        className="flex items-center gap-1.5 text-[13px] font-medium text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                      >
                        Load more alerts
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Right: AI Insights Sidebar */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }} className="space-y-5">
                <div className="rounded-[20px] border border-gray-100 bg-white p-5" style={{ boxShadow: cs }}>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600"><Sparkles className="h-3.5 w-3.5 text-white" /></div>
                    <h3 className="text-[15px] font-bold text-gray-900">AI Smart Insights</h3>
                  </div>

                  <div className="space-y-3">
                    {aiInsights.map((ins, i) => (
                      <motion.div
                        key={ins.title}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: 0.3 + i * 0.06 }}
                        className={`rounded-2xl ${ins.bg} p-3.5 transition-all duration-200 hover:scale-[1.01] cursor-pointer group`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`text-[12px] font-bold ${ins.textColor}`}>{ins.title}</p>
                              {ins.badge && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/80" style={{ color: ins.color }}>{ins.badge}</span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 leading-relaxed">{ins.desc}</p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <button className="flex items-center gap-1.5 text-[13px] font-medium text-violet-600 hover:text-violet-700 mt-4 ml-auto transition-colors">
                    View all insights
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Active Status */}
                <div className="rounded-[20px] border border-gray-100 bg-white p-5" style={{ boxShadow: cs }}>
                  <h4 className="text-[14px] font-bold text-gray-900 mb-4">System Status</h4>
                  <div className="space-y-3">
                    {[
                      { name: 'AI Moderation', status: 'Active', color: '#10B981' },
                      { name: 'Sentiment Analysis', status: 'Active', color: '#10B981' },
                      { name: 'Competitor Tracking', status: 'Active', color: '#10B981' },
                      { name: 'Viral Detection', status: 'Active', color: '#10B981' },
                      { name: 'Revenue Monitor', status: 'Active', color: '#10B981' },
                    ].map((s) => (
                      <div key={s.name} className="flex items-center justify-between">
                        <span className="text-[12px] text-gray-500">{s.name}</span>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: s.color }}>
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: s.color }} />
                            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: s.color }} />
                          </span>
                          {s.status}
                        </span>
                      </div>
                    ))}
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
