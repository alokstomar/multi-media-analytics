import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Smile,
  ShieldAlert,
  Reply,
  TrendingUp,
  Heart,
  Sparkles,
  RefreshCw,
  Clock,
  Globe,
  Database,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { useInstagramAdapter } from '../../platformAdapters/instagramAdapter'
import AccountCarousel from './AccountCarousel'
import {
  getInstagramReels,
  getInstagramComments,
  syncInstagram,
} from '../../services/api'

// ── Formatters ────────────────────────────────────────────
function fmt(n) {
  if (n == null) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function fmtDate(iso) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Constants ─────────────────────────────────────────────
const TAB_DEFS = [
  { key: 'all', label: 'All', sentiment: null },
  { key: 'positive', label: 'Positive', sentiment: 'Positive' },
  { key: 'negative', label: 'Negative', sentiment: 'Negative' },
  { key: 'questions', label: 'Questions', sentiment: 'questions' },
  { key: 'toxic', label: 'Toxic', sentiment: 'toxic' },
]

const TIME_RANGES = [
  { key: '', label: 'All Time' },
  { key: '30d', label: 'Last 30d' },
  { key: '7d', label: 'Last 7d' },
  { key: '24h', label: 'Last 24h' },
]

const VIDEO_DEPTHS = [
  { value: 5, label: '5 Reels' },
  { value: 10, label: '10 Reels' },
  { value: 25, label: '25 Reels' },
]

const VOLUME_OPTIONS = [
  { value: 100, label: '100 Comments' },
  { value: 250, label: '250 Comments' },
  { value: 500, label: '500 Comments' },
  { value: 0, label: 'All Available' },
]

const LANG_OPTIONS = [
  { value: '', label: 'All Languages' },
  { value: 'English', label: 'English' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Hinglish', label: 'Hinglish' },
]

const LIMIT_OPTIONS = [10, 20, 50]

const cardShadow = '0 1px 3px rgba(0,0,0,0.03), 0 4px 16px -4px rgba(0,0,0,0.06)'
const tip = {
  backgroundColor: '#fff',
  border: '1px solid #F3F4F6',
  borderRadius: '12px',
  boxShadow: '0 8px 24px -4px rgba(0,0,0,0.08)',
  padding: '8px 12px',
  fontSize: '12px',
}
const iconMap = {
  chat: MessageCircle,
  smile: Smile,
  star: Sparkles,
  shield: ShieldAlert,
  reply: Reply,
  trend: TrendingUp,
}

function CommentSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 rounded-[20px] bg-gray-100" />
        ))}
      </div>
      <div className="h-96 rounded-[20px] bg-gray-100" />
    </div>
  )
}

// ── Helper: classify language from comment text ──────────
function detectLanguage(text) {
  const textLower = (text || '').toLowerCase()
  if (/[क-ह]/.test(text || '')) return { language: 'Hindi', langLabel: 'HI' }
  if (
    textLower.includes('kyu') ||
    textLower.includes('bhai') ||
    textLower.includes('yaar') ||
    textLower.includes('accha')
  ) {
    return { language: 'Hinglish', langLabel: 'HING' }
  }
  return { language: 'English', langLabel: 'EN' }
}

// ── Main Component ────────────────────────────────────────
export default function CommentsIntelligence() {
  const {
    accounts = [],
    selectedAccount,
    loading: adapterLoading,
  } = useInstagramAdapter()

  const isDemo = !selectedAccount || selectedAccount.id === 'demo_ig'
  const activeAccount = isDemo ? null : selectedAccount
  const activeAccountId = activeAccount?.id
  const username = activeAccount?.handle?.replace('@', '') || ''

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [timeRange, setTimeRange] = useState('')
  const [maxVideos, setMaxVideos] = useState(10)
  const [maxVolume, setMaxVolume] = useState(0)
  const [language, setLanguage] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // Data
  const [comments, setComments] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [summary, setSummary] = useState(null)
  const [syncStatus, setSyncStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [activeAccountId, activeTab, debouncedSearch, timeRange, language])

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // ── Data Fetching ─────────────────────────────────────
  const fetchData = useCallback(
    async (opts = {}) => {
      const currentPage = opts.page ?? page
      const refresh = opts.refresh ?? false

      if (!activeAccount || !username) {
        setComments([])
        setSummary(null)
        setSyncStatus(null)
        return
      }

      setLoading(true)
      setError('')

      try {
        const reelsRes = await getInstagramReels(username)
        const reels = reelsRes?.data || []
        const reelsSlice = reels.slice(0, maxVideos)

        const commentsResults = await Promise.all(
          reelsSlice.map((r) => getInstagramComments(r.reelId, refresh))
        )

        let lastSyncTime = null
        const raw = []
        commentsResults.forEach((res, rIdx) => {
          const reel = reelsSlice[rIdx]
          const list = res?.data || []
          list.forEach((c) => {
            raw.push({ ...c, reel, channelName: activeAccount.name })
            if (!lastSyncTime || new Date(c.syncedAt) > new Date(lastSyncTime)) {
              lastSyncTime = c.syncedAt
            }
          })
        })

        // Transform
        let formatted = raw.map((c) => {
          const { language: lang, langLabel } = detectLanguage(c.text)
          const textLower = (c.text || '').toLowerCase()

          const sentimentValue = c.sentiment || 'neutral'
          const sentimentText =
            sentimentValue.charAt(0).toUpperCase() + sentimentValue.slice(1).toLowerCase()
          const sentimentCol =
            sentimentValue === 'positive' ? '#10B981' : sentimentValue === 'negative' ? '#EF4444' : '#6B7280'

          let emotionVal = 'Neutral'
          let emotionEmojiVal = '😐'
          if (sentimentValue === 'positive') {
            emotionVal = 'Joy'
            emotionEmojiVal = '😊'
          } else if (sentimentValue === 'negative') {
            emotionVal = textLower.includes('bad') || textLower.includes('fail') ? 'Sadness' : 'Anger'
            emotionEmojiVal = emotionVal === 'Sadness' ? '😢' : '😡'
          }

          const isQ = c.category === 'question' || textLower.includes('?')
          const isT = c.category === 'negative' && (textLower.includes('hate') || textLower.includes('trap'))
          const isV = sentimentValue === 'positive' && c.reel?.likes > 500

          const topics = []
          if (c.category && c.category !== 'neutral') topics.push(c.category)

          return {
            id: c.commentId,
            channelName: c.channelName || activeAccount.name,
            user: c.author || 'Anonymous',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(c.author || 'U')}&background=random`,
            comment: c.text,
            videoId: c.reelId,
            video: c.reel?.caption || 'Instagram Post',
            videoThumb:
              c.reel?.thumbnail ||
              'https://ui-avatars.com/api/?name=Reel&background=8B5CF6&color=fff&size=60',
            language: lang,
            langLabel,
            sentiment: sentimentText,
            sentimentColor: sentimentCol,
            emotion: emotionVal,
            emotionEmoji: emotionEmojiVal,
            aiScore: sentimentValue === 'positive' ? 85 : sentimentValue === 'negative' ? 30 : 55,
            isToxic: isT,
            isQuestion: isQ,
            isViral: isV,
            topics,
            likeCount: 0,
            time: timeAgo(c.syncedAt || new Date()),
            publishedAt: c.syncedAt || new Date(),
          }
        })

        // Filter by tab
        const tabDef = TAB_DEFS.find((t) => t.key === activeTab) || TAB_DEFS[0]
        if (tabDef.key !== 'all') {
          if (tabDef.key === 'toxic') formatted = formatted.filter((c) => c.isToxic)
          else if (tabDef.key === 'questions') formatted = formatted.filter((c) => c.isQuestion)
          else formatted = formatted.filter((c) => c.sentiment.toLowerCase() === tabDef.key)
        }

        // Filter by search
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase()
          formatted = formatted.filter((c) => c.comment.toLowerCase().includes(q))
        }

        // Filter by time range
        if (timeRange) {
          const now = Date.now()
          const ms = timeRange === '24h' ? 86400000 : timeRange === '7d' ? 604800000 : timeRange === '30d' ? 2592000000 : null
          if (ms) formatted = formatted.filter((c) => now - new Date(c.publishedAt).getTime() <= ms)
        }

        // Filter by language
        if (language) formatted = formatted.filter((c) => c.language === language)

        // Cap to volume (per-tab slice)
        if (maxVolume > 0) formatted = formatted.slice(0, maxVolume)

        // Paginate
        const total = formatted.length
        const totalPages = Math.max(1, Math.ceil(total / limit))
        const paginated = formatted.slice((currentPage - 1) * limit, currentPage * limit)

        setComments(paginated)
        setPagination({ page: currentPage, total, totalPages })

        // Statistics
        const posCount = formatted.filter((c) => c.sentiment === 'Positive').length
        const negCount = formatted.filter((c) => c.sentiment === 'Negative').length
        const neuCount = formatted.filter((c) => c.sentiment === 'Neutral').length

        const sentimentBreakdown = [
          { name: 'Positive', count: posCount, value: total ? parseFloat(((posCount / total) * 100).toFixed(1)) : 0, color: '#10B981' },
          { name: 'Neutral', count: neuCount, value: total ? parseFloat(((neuCount / total) * 100).toFixed(1)) : 0, color: '#6B7280' },
          { name: 'Negative', count: negCount, value: total ? parseFloat(((negCount / total) * 100).toFixed(1)) : 0, color: '#EF4444' },
        ]

        const joyCount = formatted.filter((c) => c.emotion === 'Joy').length
        const angerCount = formatted.filter((c) => c.emotion === 'Anger').length
        const sadnessCount = formatted.filter((c) => c.emotion === 'Sadness').length
        const neutralCount = formatted.filter((c) => c.emotion === 'Neutral').length

        const emotionBreakdown = [
          { name: 'Joy', count: joyCount, value: total ? parseFloat(((joyCount / total) * 100).toFixed(1)) : 0, color: '#10B981' },
          { name: 'Anger', count: angerCount, value: total ? parseFloat(((angerCount / total) * 100).toFixed(1)) : 0, color: '#EF4444' },
          { name: 'Sadness', count: sadnessCount, value: total ? parseFloat(((sadnessCount / total) * 100).toFixed(1)) : 0, color: '#3B82F6' },
          { name: 'Neutral', count: neutralCount, value: total ? parseFloat(((neutralCount / total) * 100).toFixed(1)) : 0, color: '#6B7280' },
        ]

        const langCounts = {}
        formatted.forEach((c) => {
          langCounts[c.language] = (langCounts[c.language] || 0) + 1
        })
        const languageBreakdown = Object.entries(langCounts).map(([lang, count]) => ({ lang, count }))

        const topicCounts = {}
        formatted.forEach((c) => {
          c.topics.forEach((t) => {
            topicCounts[t] = (topicCounts[t] || 0) + 1
          })
        })
        const topTopics = Object.entries(topicCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([topic, count]) => ({ topic, count }))

        const byDay = {}
        formatted.forEach((c) => {
          const key = new Date(c.publishedAt).toISOString().slice(0, 10)
          byDay[key] = (byDay[key] || 0) + 1
        })
        const commentsOverTime = Object.entries(byDay)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            count,
          }))

        const topEngagedVideos = reels
          .slice()
          .sort((a, b) => b.comments - a.comments)
          .slice(0, 5)
          .map((r) => ({
            videoId: r.reelId,
            title: r.caption || 'Instagram Post',
            comments: r.comments,
            thumbnail: r.thumbnail || 'https://ui-avatars.com/api/?name=Reel&background=8B5CF6&color=fff&size=60',
          }))

        const tabCounts = {
          all: formatted.length,
          positive: posCount,
          negative: negCount,
          questions: formatted.filter((c) => c.isQuestion).length,
          toxic: formatted.filter((c) => c.isToxic).length,
        }

        const insights = [
          {
            title: 'Overall Sentiment Positive',
            desc: `${total ? ((posCount / total) * 100).toFixed(0) : 0}% of comments show positive engagement. Reach is strong.`,
            bg: 'bg-emerald-50',
            textColor: 'text-emerald-800',
          },
          {
            title: 'FAQ content opportunity',
            desc: `${tabCounts.questions} questions found. Consider creating a post addressing them.`,
            bg: 'bg-blue-50',
            textColor: 'text-blue-800',
            extra: `+${tabCounts.questions}`,
          },
        ]
        if (tabCounts.toxic > 0) {
          insights.push({
            title: 'Toxic Comments Flagged',
            desc: `${tabCounts.toxic} comments have been flagged as toxic or negative. Consider filtering.`,
            bg: 'bg-amber-50',
            textColor: 'text-amber-800',
          })
        }

        const replySuggestions = [
          'Thanks for sharing! We appreciate the feedback.',
          'Glad you liked it! Stay tuned for more.',
          'Great question! We will address this in our next update.',
        ]

        setSyncStatus({
          totalCached: total,
          videosScanned: reels.length,
          lastFetchedAt: lastSyncTime || new Date(),
          isStale: false,
        })

        setSummary({
          stats: {
            totalComments: total,
            avgSentimentScore: total
              ? Math.round(formatted.reduce((s, c) => s + c.aiScore, 0) / total)
              : 0,
            positiveRate: total ? parseFloat(((posCount / total) * 100).toFixed(1)) : 0,
            toxicCount: tabCounts.toxic,
            toxicRate: total ? parseFloat(((tabCounts.toxic / total) * 100).toFixed(1)) : 0,
            questionCount: tabCounts.questions,
            viralCount: formatted.filter((c) => c.isViral).length,
          },
          sentimentBreakdown,
          emotionBreakdown,
          languageBreakdown,
          topTopics,
          commentsOverTime,
          topEngagedVideos,
          tabCounts,
          insights,
          replySuggestions,
        })
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Failed to load comments'
        setError(msg)
        setComments([])
        setSummary(null)
      } finally {
        setLoading(false)
      }
    },
    [activeAccount, username, page, limit, activeTab, debouncedSearch, timeRange, maxVideos, maxVolume, language]
  )

  useEffect(() => {
    if (activeAccount && username) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData])

  // ── Refresh Handler ───────────────────────────────────
  async function handleRefresh() {
    if (!username) return
    setRefreshing(true)
    setError('')
    try {
      await syncInstagram(username)
      await fetchData({ page: 1, refresh: true })
      setPage(1)
    } catch {
      setError('Failed to sync comments from Instagram. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  // ── Derived Stats ─────────────────────────────────────
  const stats = useMemo(() => {
    const s = summary?.stats || {}
    return [
      { label: 'Total Comments', value: fmt(s.totalComments), color: '#3B82F6', icon: 'chat', trend: `${fmt(s.totalComments)} cached` },
      { label: 'Positive Rate', value: `${(s.positiveRate || 0).toFixed(0)}%`, color: '#10B981', icon: 'smile', trend: 'From real analysis' },
      { label: 'Questions', value: fmt(s.questionCount), color: '#F59E0B', icon: 'star', trend: 'FAQ opportunities' },
      { label: 'Toxic', value: fmt(s.toxicCount), color: '#EF4444', icon: 'shield', trend: s.toxicCount ? 'Needs review' : 'All clear' },
      { label: 'Reels Scanned', value: fmt(syncStatus?.videosScanned), color: '#8B5CF6', icon: 'trend', trend: 'In dataset' },
    ]
  }, [summary, syncStatus])

  const tabCounts = summary?.tabCounts || {}
  const sentimentDonut = summary?.sentimentBreakdown || []
  const emotionDonut = summary?.emotionBreakdown || []
  const commentsOverTime = summary?.commentsOverTime || []
  const topVideos = summary?.topEngagedVideos || []
  const insights = summary?.insights || []
  const replies = summary?.replySuggestions || []
  const topTopics = summary?.topTopics || []
  const languageBreakdown = summary?.languageBreakdown || []
  const totalPages = pagination.totalPages || 1

  return (
    <div className="min-h-screen space-y-5">
      <AccountCarousel />

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Instagram Comment Intelligence
          </h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {activeAccount
              ? `Analyzing ${activeAccount.name} · Real comments cached in MongoDB`
              : 'Connect an Instagram account to analyze comments'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search comments..."
              className="h-10 w-52 rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      {/* Dataset Controls */}
      {activeAccount && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time Range */}
          <div className="relative">
            <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-300 pointer-events-none" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="h-8 pl-7 pr-6 rounded-xl border border-gray-200 bg-white text-[11px] font-medium text-gray-600 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
            >
              {TIME_RANGES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-300 pointer-events-none" />
          </div>

          {/* Reel Depth */}
          <div className="relative">
            <MessageCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-300 pointer-events-none" />
            <select
              value={maxVideos}
              onChange={(e) => setMaxVideos(Number(e.target.value))}
              className="h-8 pl-7 pr-6 rounded-xl border border-gray-200 bg-white text-[11px] font-medium text-gray-600 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
            >
              {VIDEO_DEPTHS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-300 pointer-events-none" />
          </div>

          {/* Volume */}
          <div className="relative">
            <Database className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-300 pointer-events-none" />
            <select
              value={maxVolume}
              onChange={(e) => setMaxVolume(Number(e.target.value))}
              className="h-8 pl-7 pr-6 rounded-xl border border-gray-200 bg-white text-[11px] font-medium text-gray-600 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
            >
              {VOLUME_OPTIONS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-300 pointer-events-none" />
          </div>

          {/* Language */}
          <div className="relative">
            <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-300 pointer-events-none" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-8 pl-7 pr-6 rounded-xl border border-gray-200 bg-white text-[11px] font-medium text-gray-600 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
            >
              {LANG_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-300 pointer-events-none" />
          </div>

          {/* Sync */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 h-8 rounded-xl border border-gray-200 bg-white px-3 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
            {refreshing ? 'Syncing...' : 'Sync from Instagram'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Body */}
      {!activeAccount ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-lg font-medium text-gray-700">No connected Instagram account</p>
          <p className="text-sm text-gray-500 mt-1">
            Connect an Instagram account above to start analyzing comments.
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CommentSkeleton />
            </motion.div>
          ) : (
            <motion.div
              key={activeAccountId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Source / Status Bar */}
              {syncStatus && (
                <div
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-3"
                  style={{ boxShadow: cardShadow }}
                >
                  <span className="flex items-center gap-1.5 text-[12px] text-gray-500">
                    <MessageCircle className="h-3.5 w-3.5 text-blue-400" />
                    <span className="font-semibold text-gray-800">{syncStatus.videosScanned || 0}</span> Reels Analyzed
                  </span>
                  <span className="h-3 w-px bg-gray-200" />
                  <span className="flex items-center gap-1.5 text-[12px] text-gray-500">
                    <MessageCircle className="h-3.5 w-3.5 text-violet-400" />
                    <span className="font-semibold text-gray-800">{fmt(syncStatus.totalCached || 0)}</span> Comments Loaded
                  </span>
                  <span className="h-3 w-px bg-gray-200" />
                  <span className="flex items-center gap-1.5 text-[12px] text-gray-500">
                    <Clock className="h-3.5 w-3.5 text-emerald-400" />
                    Last Sync: <span className="font-semibold text-gray-800 ml-1">{fmtDate(syncStatus.lastFetchedAt)}</span>
                  </span>
                  <span className="h-3 w-px bg-gray-200" />
                  <span className="flex items-center gap-1.5 text-[12px]">
                    {syncStatus.isStale === false ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-600 font-semibold">Cache Fresh</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-amber-600 font-semibold">Stale — Sync Recommended</span>
                      </>
                    )}
                  </span>
                  <div className="ml-auto">
                    <span className="text-[10px] text-gray-300">
                      Depth: {maxVideos} reels · Vol: {maxVolume === 0 ? 'All' : maxVolume} comments
                    </span>
                  </div>
                </div>
              )}

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {stats.map((s, i) => {
                  const Icon = iconMap[s.icon] || MessageCircle
                  return (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      className="rounded-[20px] border border-gray-100 bg-white p-5"
                      style={{ boxShadow: cardShadow }}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl mb-2" style={{ backgroundColor: `${s.color}12` }}>
                        <Icon className="h-4 w-4" style={{ color: s.color }} />
                      </div>
                      <p className="text-[12px] font-medium text-gray-400">{s.label}</p>
                      <p className="text-[22px] font-bold text-gray-900">{s.value}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{s.trend}</p>
                    </motion.div>
                  )
                })}
              </div>

              {/* Main Grid: Table + Right Panel */}
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Comment Table */}
                <div className="xl:col-span-3 space-y-0">
                  {/* Tabs */}
                  <div className="flex items-center justify-between border-b border-gray-100 mb-0">
                    <div className="flex items-center gap-1 overflow-x-auto">
                      {TAB_DEFS.map((t) => (
                        <button
                          key={t.key}
                          onClick={() => setActiveTab(t.key)}
                          className={`px-4 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all ${
                            activeTab === t.key
                              ? 'border-blue-600 text-blue-600'
                              : 'border-transparent text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          {t.label}
                          <span className={`ml-1 text-[11px] ${activeTab === t.key ? 'text-blue-400' : 'text-gray-300'}`}>
                            ({tabCounts[t.key] ?? tabCounts.all ?? 0})
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pr-1 shrink-0">
                      <span className="text-[11px] text-gray-400">Per page:</span>
                      {LIMIT_OPTIONS.map((l) => (
                        <button
                          key={l}
                          onClick={() => {
                            setLimit(l)
                            setPage(1)
                          }}
                          className={`text-[11px] px-2 py-1 rounded-lg transition ${limit === l ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-100'}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="rounded-[20px] border border-gray-100 bg-white overflow-hidden" style={{ boxShadow: cardShadow }}>
                    {!comments.length ? (
                      <div className="py-16 text-center text-gray-400">
                        <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">{error ? 'No comments available.' : 'No comments found for this account.'}</p>
                        {!error && (
                          <>
                            <p className="text-sm mt-1">Click "Sync from Instagram" to fetch and analyze real comments.</p>
                            <button
                              onClick={handleRefresh}
                              disabled={refreshing}
                              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                            >
                              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                              Sync Now
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Header */}
                        <div className="grid grid-cols-11 gap-2 px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100/80 bg-gray-50/40">
                          <div className="col-span-4">Comment</div>
                          <div className="col-span-2">Post</div>
                          <div className="col-span-1">Lang</div>
                          <div className="col-span-1">Sentiment</div>
                          <div className="col-span-1 text-center">Emotion</div>
                          <div className="col-span-1 text-center">Score</div>
                          <div className="col-span-1">Time</div>
                        </div>

                        {/* Rows */}
                        <div className="divide-y divide-gray-50">
                          {comments.map((c, rowIdx) => (
                            <motion.div
                              key={c.id}
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2, delay: rowIdx * 0.02 }}
                              className="grid grid-cols-11 gap-2 items-center px-5 py-3.5 hover:bg-blue-50/30 transition-colors group"
                            >
                              <div className="col-span-4 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <p className="text-[12px] font-bold text-gray-800 truncate">{c.user}</p>
                                  {c.isViral && (
                                    <span className="shrink-0 text-[8px] font-bold bg-amber-100 text-amber-600 px-1 rounded-full">
                                      VIRAL
                                    </span>
                                  )}
                                </div>
                                <p className="text-[12px] text-gray-600 line-clamp-2">{c.comment}</p>
                                {c.topics?.length > 0 && (
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {c.topics.slice(0, 2).map((t) => (
                                      <span key={t} className="text-[9px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="col-span-2 flex items-center gap-2 min-w-0">
                                <img
                                  src={c.videoThumb}
                                  alt=""
                                  className="h-7 w-7 rounded-lg object-cover shrink-0 ring-1 ring-gray-100"
                                  onError={(e) => {
                                    e.target.src = 'https://ui-avatars.com/api/?name=V&background=3B82F6&color=fff&size=60'
                                  }}
                                />
                                <span className="text-[11px] text-gray-500 truncate">{c.video}</span>
                              </div>

                              <div className="col-span-1">
                                <span
                                  className={`inline-flex rounded-full px-1.5 py-[2px] text-[10px] font-semibold ${
                                    c.language === 'Hindi'
                                      ? 'bg-orange-50 text-orange-600'
                                      : c.language === 'Hinglish'
                                      ? 'bg-violet-50 text-violet-600'
                                      : 'bg-gray-50 text-gray-500'
                                  }`}
                                >
                                  {c.langLabel}
                                </span>
                              </div>

                              <div className="col-span-1">
                                <span
                                  className="inline-flex rounded-full px-2 py-[2px] text-[10px] font-bold"
                                  style={{ backgroundColor: `${c.sentimentColor}14`, color: c.sentimentColor }}
                                >
                                  {c.sentiment}
                                </span>
                              </div>

                              <div className="col-span-1 text-center">
                                <span className="text-sm">{c.emotionEmoji}</span>
                                <p className="text-[9px] text-gray-400">{c.emotion}</p>
                              </div>

                              <div className="col-span-1 text-center">
                                <span
                                  className="text-[11px] font-bold"
                                  style={{ color: c.aiScore >= 80 ? '#10B981' : c.aiScore >= 50 ? '#F59E0B' : '#EF4444' }}
                                >
                                  {c.aiScore}
                                </span>
                              </div>

                              <div className="col-span-1 text-[11px] text-gray-400">{c.time}</div>
                            </motion.div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/30">
                      <span className="text-[11px] text-gray-400">
                        {pagination.total > 0
                          ? `${(page - 1) * limit + 1}–${Math.min(page * limit, pagination.total)} of ${fmt(pagination.total)} comments`
                          : 'No comments'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="text-[11px] px-2 py-1 disabled:opacity-30 cursor-pointer text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          ← Prev
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                          const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                          const p = start + i
                          if (p > totalPages) return null
                          return (
                            <button
                              key={p}
                              onClick={() => setPage(p)}
                              className={`min-w-[28px] h-7 rounded-lg text-[11px] font-medium transition ${
                                p === page ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-100'
                              }`}
                            >
                              {p}
                            </button>
                          )
                        })}
                        <button
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className="text-[11px] px-2 py-1 disabled:opacity-30 cursor-pointer text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Panel */}
                <div className="space-y-5">
                  <div className="rounded-[20px] border border-gray-100 bg-white p-5" style={{ boxShadow: cardShadow }}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                        <Sparkles className="h-3.5 w-3.5 text-white" />
                      </div>
                      <h3 className="text-[14px] font-bold text-gray-900">AI Comment Insights</h3>
                    </div>
                    <div className="space-y-3">
                      {insights.length ? (
                        insights.map((ins, i) => (
                          <motion.div
                            key={ins.title}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: i * 0.06 }}
                            className={`rounded-2xl ${ins.bg} p-3.5 group cursor-pointer hover:scale-[1.01] transition-transform`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className={`text-[12px] font-bold ${ins.textColor}`}>{ins.title}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{ins.desc}</p>
                                {ins.extra && (
                                  <span className="mt-1.5 inline-flex text-[10px] font-bold text-blue-600 bg-blue-100 rounded-full px-1.5 py-0.5">
                                    {ins.extra}
                                  </span>
                                )}
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-gray-500 mt-0.5 transition-colors" />
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-400 py-4 text-center">Sync comments to generate insights</p>
                      )}
                    </div>
                  </div>

                  {replies.length > 0 && (
                    <div className="rounded-[20px] border border-gray-100 bg-white p-5" style={{ boxShadow: cardShadow }}>
                      <h3 className="text-[14px] font-bold text-gray-900 mb-3">Suggested Replies</h3>
                      <div className="space-y-2">
                        {replies.map((r, i) => (
                          <div
                            key={i}
                            className="rounded-xl border border-gray-100 px-3 py-2.5 text-[12px] text-gray-600 hover:bg-blue-50/50 hover:border-blue-200 transition-colors cursor-pointer"
                          >
                            {r}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Analytics Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                <DonutCard title="Sentiment Breakdown" data={sentimentDonut} total={summary?.stats?.totalComments} />
                <DonutCard title="Emotion Detection" data={emotionDonut} total={summary?.stats?.totalComments} />

                <div className="rounded-[20px] border border-gray-100 bg-white p-5" style={{ boxShadow: cardShadow }}>
                  <h4 className="text-[14px] font-bold text-gray-900 mb-3">Comments Over Time</h4>
                  <div className="h-[140px]">
                    {commentsOverTime.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={commentsOverTime} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="cotG" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.15} />
                              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#D1D5DB' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: '#D1D5DB' }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={tip} />
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            fill="url(#cotG)"
                            dot={{ r: 2, fill: '#3B82F6', stroke: '#fff', strokeWidth: 1 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-gray-400 py-8 text-center">Sync to see timeline</p>
                    )}
                  </div>
                </div>

                <div className="rounded-[20px] border border-gray-100 bg-white p-5" style={{ boxShadow: cardShadow }}>
                  <h4 className="text-[14px] font-bold text-gray-900 mb-3">Top Engaged Posts</h4>
                  <div className="space-y-3">
                    {topVideos.length ? (
                      topVideos.map((v, i) => (
                        <div key={v.videoId || i} className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-100 text-[10px] font-bold text-gray-400 shrink-0">
                            {i + 1}
                          </span>
                          <img
                            src={v.thumbnail}
                            alt=""
                            className="h-6 w-6 rounded-md object-cover shrink-0"
                            onError={(e) => {
                              e.target.src = 'https://ui-avatars.com/api/?name=R&background=8B5CF6&color=fff&size=48'
                            }}
                          />
                          <span className="text-[12px] text-gray-600 truncate flex-1">{v.title}</span>
                          <span className="text-[12px] font-bold text-gray-800 shrink-0">{fmt(v.comments)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">From reel metadata in DB</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Extended Analytics: Topics + Language */}
              {(topTopics.length > 0 || languageBreakdown.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {topTopics.length > 0 && (
                    <div className="rounded-[20px] border border-gray-100 bg-white p-5" style={{ boxShadow: cardShadow }}>
                      <h4 className="text-[14px] font-bold text-gray-900 mb-4">Top Comment Topics</h4>
                      <div className="h-[160px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topTopics} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                            <XAxis type="number" tick={{ fontSize: 9, fill: '#D1D5DB' }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="topic" tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={false} tickLine={false} width={100} />
                            <Tooltip contentStyle={tip} />
                            <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} maxBarSize={10} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {languageBreakdown.length > 0 && (
                    <div className="rounded-[20px] border border-gray-100 bg-white p-5" style={{ boxShadow: cardShadow }}>
                      <h4 className="text-[14px] font-bold text-gray-900 mb-4">Language Distribution</h4>
                      <div className="space-y-3">
                        {languageBreakdown.map(({ lang, count }) => {
                          const total = languageBreakdown.reduce((s, l) => s + l.count, 0) || 1
                          const pct = ((count / total) * 100).toFixed(1)
                          const color = lang === 'Hindi' ? '#F59E0B' : lang === 'Hinglish' ? '#8B5CF6' : '#3B82F6'
                          return (
                            <div key={lang}>
                              <div className="flex justify-between text-[12px] mb-1">
                                <span className="text-gray-600 font-medium">{lang}</span>
                                <span className="font-bold text-gray-800">
                                  {pct}% <span className="text-gray-400 font-normal">({fmt(count)})</span>
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {LANG_OPTIONS.filter((l) => l.value).map((l) => {
                          const item = languageBreakdown.find((x) => x.lang === l.value)
                          if (!item) return null
                          return (
                            <button
                              key={l.value}
                              onClick={() => setLanguage(language === l.value ? '' : l.value)}
                              className={`text-[11px] rounded-full px-2.5 py-1 font-semibold transition-all border ${
                                language === l.value
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-200 text-gray-500 hover:border-blue-300'
                              }`}
                            >
                              Filter: {l.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

// ── Helper Components ──────────────────────────────────────
function DonutCard({ title, data, total }) {
  return (
    <div className="rounded-[20px] border border-gray-100 bg-white p-5" style={{ boxShadow: cardShadow }}>
      <h4 className="text-[14px] font-bold text-gray-900 mb-2">{title}</h4>
      {!data?.length ? (
        <p className="text-sm text-gray-400 py-8 text-center">Sync comments to see breakdown</p>
      ) : (
        <div className="flex items-center gap-3">
          <div className="relative h-[110px] w-[110px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={34} outerRadius={50} paddingAngle={2} strokeWidth={0}>
                  {data.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[13px] font-bold text-gray-900">{fmt(total)}</span>
              <span className="text-[9px] text-gray-400">Total</span>
            </div>
          </div>
          <div className="flex-1 space-y-1.5">
            {data.slice(0, 5).map((s) => (
              <div key={s.name} className="flex justify-between items-center text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-gray-500">{s.name}</span>
                </div>
                <span className="font-bold text-gray-700">{s.value}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
