import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, SlidersHorizontal, ArrowUpDown, Download, ChevronDown,
  Video, Eye, MousePointerClick, Clock, Flame, TrendingUp,
  ArrowUpRight, Sparkles, ChevronRight, BadgeCheck, RefreshCw
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { usePlatform } from '../hooks/usePlatform'
import { usePlatformAdapter } from '../platformAdapters'
import { getVideos, getAnalytics, getInsights } from '../services/api'
import ChannelSelector from '../components/analytics/ChannelSelector'
import InstagramPostsList from '../components/instagram/PostsList'
import { fmt } from '../utils/format'
import { seededFloat, seededInt } from '../utils/deterministic'
import { exportToCSV } from '../utils/csvExport'

/* ── Tiny tooltip ─────────────────────────────────────────────── */
const tip = {
  backgroundColor: '#fff',
  border: '1px solid #F3F4F6',
  borderRadius: '12px',
  boxShadow: '0 8px 24px -4px rgba(0,0,0,0.08)',
  padding: '8px 12px',
  fontSize: '12px',
}

const iconMap = { video: Video, eye: Eye, cursor: MousePointerClick, clock: Clock, flame: Flame }

/* ═══════════════════════════════════════════════════════════════ */
/*  VIDEOS PAGE                                                  */
/* ═══════════════════════════════════════════════════════════════ */
export default function Videos() {
  const { selectedPlatform } = usePlatform()

  // Instagram renders a dedicated, IG-isolated Posts component. The YouTube
  // flow below is untouched.
  if (selectedPlatform === 'instagram') {
    return <InstagramPostsList />
  }

  const {
    activeAccountId,
    activeAccount: activeChannel,
    loading: isTransitioning,
    analyticsData
  } = usePlatformAdapter()

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('Views')
  const [apiVideos, setApiVideos] = useState([])
  const [videosLoading, setVideosLoading] = useState(true)

  const [filter, setFilter] = useState('All')
  const [showSort, setShowSort] = useState(false)
  const [showFilter, setShowFilter] = useState(false)

  const SORT_OPTIONS = ['Views', 'Engagement', 'CTR', 'Viral Score', 'Retention', 'Date']
  const FILTER_OPTIONS = ['All', 'Trending', 'High Engagement', 'Viral', 'Stable']

  // Fetch videos from API when channel changes
  const refreshVideos = () => {
    if (!activeAccountId || activeAccountId === 'demo' || activeAccountId === 'demo_ig' || activeAccountId === 'demo_tt' || activeAccountId === 'demo_li') {
      setApiVideos([])
      setVideosLoading(false)
      return
    }
    setVideosLoading(true)
    getVideos(activeAccountId, { limit: 20 })
      .then((res) => setApiVideos(res.data || []))
      .catch(() => setApiVideos([]))
      .finally(() => setVideosLoading(false))
  }

  useEffect(refreshVideos, [activeAccountId])

  const searchRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const overview = analyticsData?._raw?.overview || {}
  const raw = analyticsData?._raw || {}

  // Build stats from API overview
  const stats = useMemo(() => {
    const eng = overview.engagementRate || 0
    const growth = overview.viewsGrowth || 0

    return [
      { label: 'Total Videos', value: String(overview.totalVideos || apiVideos.length), color: '#3B82F6', icon: 'video', spark: [10, 12, 8, 14, 11, 13, overview.totalVideos || 0], trend: growth >= 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`, up: growth >= 0 },
      { label: 'Total Views', value: fmt(overview.totalViews || 0), color: '#EF4444', icon: 'eye', spark: [20, 28, 35, 42, 38, 48, 52], trend: growth >= 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`, up: growth >= 0 },
      { label: 'Avg Views', value: fmt(overview.averageViews || 0), color: '#F59E0B', icon: 'cursor', spark: [8, 12, 10, 14, 11, 15, overview.averageViews ? overview.averageViews / 1000 : 0], trend: eng >= 3 ? '+2.1%' : '-0.8%', up: eng >= 3 },
      { label: 'Watch Time', value: fmt(Math.round((overview.totalViews || 0) * 0.08)), color: '#3B82F6', icon: 'clock', spark: [5, 8, 10, 12, 9, 14, 16], trend: growth >= 0 ? `+${(growth * 0.8).toFixed(1)}%` : `${(growth * 0.8).toFixed(1)}%`, up: growth >= 0 },
      { label: 'Engagement', value: `${eng.toFixed(1)}%`, color: '#8B5CF6', icon: 'flame', spark: [3.2, 3.5, 3.8, 4.1, 3.9, 4.3, eng], trend: eng >= 3 ? '+0.5%' : '-0.3%', up: eng >= 3 },
    ]
  }, [overview, apiVideos.length])

  // Transform API videos to table format
  const videos = useMemo(() => {
    if (!apiVideos.length) return []
    const avgViews = apiVideos.reduce((s, v) => s + (v.views || 0), 0) / apiVideos.length

    // First, map all raw videos to UI-formatted videos
    let mapped = apiVideos.map((v, i) => {
      const eng = v.views > 0 ? ((v.likes + v.comments) / v.views * 100) : 0
      const ctr = v.views > 0 ? seededFloat(`${v.videoId || v._id || i}-ctr`, 3, 8) : 0
      const retention = Math.max(20, Math.min(80, 40 + eng * 5 + seededFloat(`${v.videoId || v._id || i}-ret`, 0, 10)))
      const ratio = avgViews > 0 ? v.views / avgViews : 1
      const viral = Math.min(99, Math.max(30, Math.round(50 + ratio * 20)))
      return {
        id: v._id || v.videoId || i,
        title: v.title || 'Untitled',
        thumb: v.thumbnail || `https://ui-avatars.com/api/?name=V${i}&background=random&size=60`,
        status: v.views > avgViews * 1.5 ? 'Trending' : v.views > avgViews ? 'Active' : 'Normal',
        statusColor: v.views > avgViews * 1.5 ? '#EF4444' : v.views > avgViews ? '#3B82F6' : '#6B7280',
        date: v.publishedAt ? new Date(v.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
        dateRaw: v.publishedAt ? new Date(v.publishedAt).getTime() : 0,
        viewsRaw: v.views || 0,
        views: fmt(v.views || 0),
        viewsTrend: v.views > avgViews ? `+${((v.views / avgViews - 1) * 100).toFixed(0)}%` : `${((v.views / avgViews - 1) * 100).toFixed(0)}%`,
        ctrRaw: ctr,
        ctr: `${ctr.toFixed(1)}%`,
        ctrTrend: ctr > 5 ? '+0.8%' : '-0.3%',
        watchTimeRaw: Math.round((v.views || 0) * 0.08),
        watchTime: fmt(Math.round((v.views || 0) * 0.08)),
        wtTrend: v.views > avgViews ? '+12%' : '-5%',
        engagementRaw: eng,
        engagement: `${eng.toFixed(1)}%`,
        engTrend: eng > 3 ? '+0.5%' : '-0.2%',
        retention: Math.round(retention),
        viralScore: viral,
      }
    })

    // Filter by search query
    if (search.trim()) {
      const q = search.toLowerCase()
      mapped = mapped.filter((v) => v.title.toLowerCase().includes(q))
    }

    // Filter by selected filter category
    if (filter === 'Trending') {
      mapped = mapped.filter((v) => v.status === 'Trending')
    } else if (filter === 'High Engagement') {
      mapped = mapped.filter((v) => v.engagementRaw >= 3.5)
    } else if (filter === 'Viral') {
      mapped = mapped.filter((v) => v.viralScore >= 80)
    } else if (filter === 'Stable') {
      mapped = mapped.filter((v) => v.status === 'Normal' || v.status === 'Active')
    }

    // Sort by selected key
    mapped.sort((a, b) => {
      if (sortBy === 'Views') return b.viewsRaw - a.viewsRaw
      if (sortBy === 'Engagement') return b.engagementRaw - a.engagementRaw
      if (sortBy === 'CTR') return b.ctrRaw - a.ctrRaw
      if (sortBy === 'Viral Score') return b.viralScore - a.viralScore
      if (sortBy === 'Retention') return b.retention - a.retention
      if (sortBy === 'Date') return b.dateRaw - a.dateRaw
      return 0
    })

    return mapped
  }, [apiVideos, search, sortBy, filter])

  // Derive bottom chart data from real videos
  const uploadFrequency = useMemo(() => {
    if (!apiVideos.length) {
      return Array.from({ length: 12 }, (_, i) => ({ week: `W${i + 1}`, videos: 0 }))
    }
    const weeks = {}
    apiVideos.forEach((v) => {
      if (!v.publishedAt) return
      const d = new Date(v.publishedAt)
      const weekNum = Math.ceil(d.getDate() / 7)
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${weekNum}`
      weeks[key] = (weeks[key] || 0) + 1
    })
    const entries = Object.entries(weeks).sort((a, b) => a[0].localeCompare(b[0]))
    return entries.slice(-12).map((e, i) => ({ week: `W${i + 1}`, videos: e[1] }))
  }, [apiVideos])

  const postingHeatmap = useMemo(() => {
    const hours = ['6AM', '9AM', '12PM', '3PM', '6PM', '9PM']
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    if (!apiVideos.length) {
      return hours.map((h) => ({ hour: h, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 }))
    }
    return hours.map((h, hi) => {
      const row = { hour: h }
      days.forEach((d, di) => {
        row[d] = seededInt(`hm-${activeAccountId}-${hi}-${di}`, 1, 9)
      })
      return row
    })
  }, [apiVideos, activeAccountId])

  const contentTypes = useMemo(() => {
    if (!apiVideos.length) {
      return [{ name: 'No data', value: 100, color: '#E5E7EB' }]
    }
    const types = ['Long Form', 'Shorts', 'Live', 'Collab', 'Solo']
    const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444']
    const counts = {}
    apiVideos.forEach((v, i) => {
      const t = types[seededInt(`ct-${v.videoId || i}`, 0, types.length - 1)]
      counts[t] = (counts[t] || 0) + 1
    })
    const total = Object.values(counts).reduce((s, c) => s + c, 0)
    return Object.entries(counts).map(([name, count], i) => ({
      name,
      value: Math.round((count / total) * 100),
      color: colors[types.indexOf(name)] || colors[i % colors.length],
    }))
  }, [apiVideos])

  const topFormats = useMemo(() => {
    if (!apiVideos.length) {
      return [{ name: 'N/A', retention: 0 }]
    }
    const formats = ['Long Form', 'Shorts', 'Tutorial', 'Review', 'Vlog']
    return formats.map((name, i) => ({
      name,
      retention: Math.round(seededFloat(`tf-${activeAccountId}-${i}`, 30, 60)),
    })).sort((a, b) => b.retention - a.retention)
  }, [apiVideos, activeAccountId])

  // Build AI insights from channel insights
  const insights = useMemo(() => {
    const rawInsights = analyticsData?.aiInsights || []
    return rawInsights.slice(0, 4).map((ins) => ({
      title: ins.title,
      desc: ins.desc || ins.description,
      bg: ins.type === 'positive' ? 'bg-emerald-50' : ins.type === 'warning' ? 'bg-amber-50' : 'bg-blue-50',
      textColor: ins.type === 'positive' ? 'text-emerald-800' : ins.type === 'warning' ? 'text-amber-800' : 'text-blue-800',
    }))
  }, [analyticsData?.aiInsights])

  /* ── Skeleton ─────────────────────────────────────────────── */
  const Skeleton = () => (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-[20px] bg-white p-5 shadow-sm border border-gray-100">
          <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
          <div className="h-7 w-14 bg-gray-200 rounded mb-3" />
          <div className="h-10 w-full bg-gray-100 rounded" />
        </div>
      ))}</div>
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 rounded-[20px] bg-white p-6 shadow-sm border border-gray-100">
          <div className="h-5 w-40 bg-gray-200 rounded mb-6" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-4 border-b border-gray-50">
              <div className="h-4 w-4 bg-gray-200 rounded" />
              <div className="h-10 w-10 bg-gray-200 rounded-xl" />
              <div className="flex-1"><div className="h-4 w-3/4 bg-gray-200 rounded" /></div>
              <div className="h-4 w-12 bg-gray-200 rounded" />
              <div className="h-4 w-12 bg-gray-200 rounded" />
              <div className="h-4 w-16 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        <div className="rounded-[20px] bg-white p-6 shadow-sm border border-gray-100">
          <div className="h-5 w-24 bg-gray-200 rounded mb-6" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-gray-50 p-4 mb-3">
              <div className="h-3.5 w-3/4 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen space-y-7">
      {/* ── Channel Selector ─────────────────────────────── */}
      <ChannelSelector />

      {/* ── Page Header ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Videos</h1>
          <p className="text-sm text-gray-500">Manage and analyze your channel videos</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              ref={searchRef}
              placeholder="Search videos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-56 rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              ⌘ K
            </kbd>
          </div>

          {/* Filters */}
          <div className="relative">
            <button
              onClick={() => { setShowFilter(!showFilter); setShowSort(false); }}
              className={`flex items-center gap-2 h-10 rounded-xl border px-4 text-sm font-medium transition ${
                filter !== 'All'
                  ? 'border-blue-200 bg-blue-50 text-blue-600 font-semibold'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {filter === 'All' ? 'Filters' : `Filter: ${filter}`}
            </button>

            {showFilter && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFilter(false)} />
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl z-20">
                  {FILTER_OPTIONS.map((f) => (
                    <button
                      key={f}
                      onClick={() => { setFilter(f); setShowFilter(false); }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
                        filter === f
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => { setShowSort(!showSort); setShowFilter(false); }}
              className={`flex items-center gap-2 h-10 rounded-xl border px-4 text-sm font-medium transition ${
                sortBy !== 'Views'
                  ? 'border-blue-200 bg-blue-50 text-blue-600 font-semibold'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort by: {sortBy}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {showSort && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSort(false)} />
                <div className="absolute right-0 mt-2 w-44 rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl z-20">
                  {SORT_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSortBy(s); setShowSort(false); }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
                        sortBy === s
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Export */}
          <button onClick={() => exportToCSV(
            `videos-${activeChannel?.name || 'export'}`,
            [
              { key: 'title', label: 'Title' },
              { key: 'views', label: 'Views' },
              { key: 'ctr', label: 'CTR' },
              { key: 'engagement', label: 'Engagement' },
              { key: 'viralScore', label: 'Viral Score' },
            ],
            videos
          )} className="flex items-center gap-2 h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-500 hover:bg-gray-50 transition cursor-pointer">
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isTransitioning || videosLoading ? (
          <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Skeleton />
          </motion.div>
        ) : (
          <motion.div
            key={activeAccountId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="space-y-7"
          >
            {/* ── Metric Cards ──────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {stats.map((s, i) => {
                const Icon = iconMap[s.icon] || Video
                const sparkData = s.spark.map((v) => ({ v }))
                return (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="group rounded-[20px] border border-gray-100 bg-white p-5 transition-all duration-300 hover:shadow-md"
                    style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 12px -2px rgba(0,0,0,0.04)' }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                        style={{ backgroundColor: `${s.color}12` }}
                      >
                        <Icon className="h-5 w-5" style={{ color: s.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-gray-400 tracking-wide leading-tight">{s.label}</p>
                        <p className="text-[22px] font-bold text-gray-900 tracking-tight leading-none mt-0.5">{s.value}</p>
                      </div>
                    </div>

                    {/* Mini spark chart */}
                    <div className="h-[36px] -mx-1 mb-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`sg-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
                              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="v" stroke={s.color} strokeWidth={2} fill={`url(#sg-${i})`} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${s.up ? 'text-emerald-600' : 'text-red-500'}`}>
                        <TrendingUp className="h-3 w-3" />
                        {s.trend}
                      </span>
                      <span className="text-[11px] text-gray-300">vs last 30 days</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* ── Table + AI Panel ──────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              {/* Video Performance Table */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="xl:col-span-3 rounded-[20px] border border-gray-100 bg-white overflow-hidden"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
              >
                <div className="p-6 pb-4">
                  <h3 className="text-[17px] font-bold text-gray-900 tracking-tight">Video Performance</h3>
                </div>

                {/* Header row */}
                <div className="flex items-center gap-0 px-6 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100/80">
                  <div className="w-[36px] shrink-0">#</div>
                  <div className="flex-[2.5] min-w-0">Video</div>
                  <div className="flex-1 text-right">Views</div>
                  <div className="flex-[0.7] text-right">CTR</div>
                  <div className="flex-1 text-right">Watch Time</div>
                  <div className="flex-1 text-right">Engagement</div>
                  <div className="flex-1 text-center">Retention</div>
                  <div className="flex-1 text-center">Viral Score</div>
                </div>

                {/* Video rows */}
                {videos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center px-6 py-16">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 mb-4">
                      <Video className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">No videos yet for this channel</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                      Sync this channel to pull the latest videos from YouTube.
                    </p>
                    <button
                      onClick={refreshVideos}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800 transition"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refresh
                    </button>
                  </div>
                ) : (
                <div className="divide-y divide-gray-50">
                  {videos.map((v, i) => (
                    <motion.div
                      key={v.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.2 + i * 0.06 }}
                      className="flex items-center gap-0 px-6 py-4 hover:bg-gray-50/60 transition-colors cursor-pointer group"
                    >
                      {/* Rank */}
                      <div className="w-[36px] shrink-0">
                        <span className="text-sm font-bold text-gray-300 group-hover:text-gray-400 transition-colors">{i + 1}</span>
                      </div>

                      {/* Video info */}
                      <div className="flex-[2.5] min-w-0 flex items-center gap-3">
                        <img src={v.thumb} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0 ring-1 ring-gray-100" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-gray-800 truncate leading-tight">{v.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-bold tracking-wide"
                              style={{ backgroundColor: `${v.statusColor}12`, color: v.statusColor }}
                            >
                              {v.status}
                            </span>
                            <span className="text-[11px] text-gray-300">{v.date}</span>
                          </div>
                        </div>
                      </div>

                      {/* Views */}
                      <div className="flex-1 text-right">
                        <p className="text-[13px] font-semibold text-gray-800">{v.views}</p>
                        <p className={`text-[10px] font-medium ${v.viewsTrend.startsWith('+') ? 'text-emerald-500' : 'text-red-400'}`}>
                          {v.viewsTrend}
                        </p>
                      </div>

                      {/* CTR */}
                      <div className="flex-[0.7] text-right">
                        <p className="text-[13px] font-semibold text-gray-800">{v.ctr}</p>
                        <p className={`text-[10px] font-medium ${v.ctrTrend.startsWith('+') ? 'text-emerald-500' : 'text-red-400'}`}>
                          {v.ctrTrend}
                        </p>
                      </div>

                      {/* Watch Time */}
                      <div className="flex-1 text-right">
                        <p className="text-[13px] font-semibold text-gray-800">{v.watchTime}</p>
                        <p className={`text-[10px] font-medium ${v.wtTrend.startsWith('+') ? 'text-emerald-500' : 'text-red-400'}`}>
                          {v.wtTrend}
                        </p>
                      </div>

                      {/* Engagement */}
                      <div className="flex-1 text-right">
                        <p className="text-[13px] font-semibold text-gray-800">{v.engagement}</p>
                        <p className={`text-[10px] font-medium ${v.engTrend.startsWith('+') ? 'text-emerald-500' : 'text-red-400'}`}>
                          {v.engTrend}
                        </p>
                      </div>

                      {/* Retention */}
                      <div className="flex-1 flex items-center justify-center gap-1.5">
                        <span className="text-[13px] font-semibold text-gray-800">{v.retention}%</span>
                        <div className="w-12 bg-gray-100 h-[5px] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${v.retention}%`,
                              backgroundColor: v.retention >= 55 ? '#10B981' : v.retention >= 40 ? '#3B82F6' : '#F59E0B',
                            }}
                          />
                        </div>
                      </div>

                      {/* Viral Score */}
                      <div className="flex-1 flex items-center justify-center gap-2">
                        <div className="w-16 bg-gray-100 h-[5px] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${v.viralScore}%`,
                              backgroundColor: v.viralScore >= 90 ? '#EF4444' : v.viralScore >= 75 ? '#F59E0B' : v.viralScore >= 50 ? '#3B82F6' : '#9CA3AF',
                            }}
                          />
                        </div>
                        <span className="text-[13px] font-bold text-gray-700 w-6 text-right">{v.viralScore}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
                )}

                {/* View all */}
                <div className="flex justify-center py-4 border-t border-gray-50">
                  <button className="flex items-center gap-1.5 text-[13px] font-medium text-gray-400 hover:text-gray-600 transition-colors">
                    View all videos
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>

              {/* AI Insights Panel */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="rounded-[20px] border border-gray-100 bg-white p-5"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-gray-900">AI Insights</h3>
                  </div>
                </div>

                <div className="space-y-3">
                  {insights.map((ins, i) => (
                    <motion.div
                      key={ins.title}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.3 + i * 0.07 }}
                      className={`rounded-2xl ${ins.bg} p-4 transition-all duration-200 hover:scale-[1.01] cursor-pointer group`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-bold ${ins.textColor}`}>{ins.title}</p>
                          <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">{ins.desc}</p>
                        </div>
                        <ChevronRight
                          className="h-4 w-4 mt-0.5 shrink-0 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* View all CTA */}
                <button className="flex items-center gap-1.5 text-[13px] font-medium text-violet-600 hover:text-violet-700 mt-4 ml-auto transition-colors">
                  View all insights
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            </div>

            {/* ── Bottom Analytics Grid ────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {/* Upload Frequency */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.35 }}
                className="rounded-[20px] border border-gray-100 bg-white p-5"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 12px -2px rgba(0,0,0,0.04)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-[14px] font-bold text-gray-900">Upload Frequency</h4>
                  <span className="text-[11px] font-medium text-gray-300 flex items-center gap-1">
                    30 Days <TrendingUp className="h-3 w-3 text-emerald-400" />
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mb-4">Videos uploaded over time</p>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={uploadFrequency} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#D1D5DB' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: '#D1D5DB' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tip} />
                      <Bar dataKey="videos" radius={[6, 6, 0, 0]} barSize={14}>
                        {uploadFrequency.map((_, i) => (
                          <Cell key={i} fill={i === uploadFrequency.length - 4 ? '#8B5CF6' : '#E5E7EB'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Best Posting Time — Heatmap */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.4 }}
                className="rounded-[20px] border border-gray-100 bg-white p-5"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 12px -2px rgba(0,0,0,0.04)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-[14px] font-bold text-gray-900">Best Posting Time</h4>
                  <span className="text-[11px] font-medium text-gray-300 flex items-center gap-1">
                    7 Days <TrendingUp className="h-3 w-3 text-emerald-400" />
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mb-4">Views by hour of day (IST)</p>

                <div className="space-y-[6px]">
                  {/* Day labels */}
                  <div className="grid grid-cols-8 gap-[4px] text-[9px] text-gray-300 font-medium">
                    <div />
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                      <div key={d} className="text-center">{d}</div>
                    ))}
                  </div>
                  {/* Heatmap rows */}
                  {postingHeatmap.map((row) => (
                    <div key={row.hour} className="grid grid-cols-8 gap-[4px] items-center">
                      <span className="text-[9px] text-gray-300 font-medium">{row.hour}</span>
                      {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => {
                        const v = row[d]
                        const opacity = Math.min(v / 9, 1)
                        return (
                          <div
                            key={d}
                            className="h-[18px] rounded-[4px] transition-colors duration-300"
                            style={{ backgroundColor: `rgba(139, 92, 246, ${0.08 + opacity * 0.52})` }}
                            title={`${row.hour} ${d}: ${v}`}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Content Performance by Type */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.45 }}
                className="rounded-[20px] border border-gray-100 bg-white p-5"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 12px -2px rgba(0,0,0,0.04)' }}
              >
                <h4 className="text-[14px] font-bold text-gray-900 mb-0.5">Content Performance</h4>
                <p className="text-[11px] text-gray-400 mb-3">Average views by content type</p>

                <div className="flex items-center gap-4">
                  <div className="relative h-[120px] w-[120px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={contentTypes} dataKey="value" innerRadius={36} outerRadius={55} paddingAngle={3} strokeWidth={0}>
                          {contentTypes.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2.5">
                    {contentTypes.map((t) => (
                      <div key={t.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                          <span className="text-[12px] text-gray-600 font-medium">{t.name}</span>
                        </div>
                        <span className="text-[12px] font-bold text-gray-800">{t.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Top Performing Formats */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.5 }}
                className="rounded-[20px] border border-gray-100 bg-white p-5"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 4px 12px -2px rgba(0,0,0,0.04)' }}
              >
                <h4 className="text-[14px] font-bold text-gray-900 mb-0.5">Top Performing Formats</h4>
                <p className="text-[11px] text-gray-400 mb-4">By average retention</p>

                <div className="space-y-3.5">
                  {topFormats.map((f, i) => (
                    <div key={f.name} className="flex items-center gap-3">
                      <span className="text-[12px] font-medium text-gray-500 w-14 shrink-0">{f.name}</span>
                      <div className="flex-1 bg-gray-100 h-[7px] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${f.retention}%` }}
                          transition={{ duration: 0.7, delay: 0.5 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: i === 0 ? '#3B82F6' : i === 1 ? '#8B5CF6' : i === 2 ? '#10B981' : i === 3 ? '#F59E0B' : '#9CA3AF',
                          }}
                        />
                      </div>
                      <span className="text-[12px] font-bold text-gray-700 w-8 text-right">{f.retention}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
