import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  ArrowUpDown,
  RefreshCw,
  AlertCircle,
  Film,
  Layers,
  Image as ImageIcon,
  Circle,
  ChevronUp,
  ChevronDown,
  Heart,
  MessageSquare,
  Eye,
  Bookmark,
  Share2,
  TrendingUp,
  Clock,
} from 'lucide-react'
import { useInstagramAdapter } from '../../platformAdapters/instagramAdapter'
import { getInstagramPosts } from '../../services/api'
import { fmt } from '../../utils/format'
import AccountCarousel from './AccountCarousel'

// ── Constants ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'All', label: 'All Posts', icon: Layers },
  { id: 'Reel', label: 'Reels', icon: Film },
  { id: 'Carousel', label: 'Carousel', icon: Layers },
  { id: 'Story', label: 'Stories', icon: Circle },
]

const SORTS = [
  { id: 'date', label: 'Date' },
  { id: 'reach', label: 'Reach' },
  { id: 'likes', label: 'Likes' },
  { id: 'comments', label: 'Comments' },
  { id: 'engagement', label: 'Engagement' },
]

// Impressions are not exposed by the IG provider; estimate from reach.
// Marked "est" in the UI. Matches backend analytics math (reach * 1.3).
const estimateImpressions = (reach) => Math.round((reach || 0) * 1.3)

// ── Skeleton ──────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden animate-pulse">
      <div className="h-12 bg-gray-50 border-b border-gray-100" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-4 border-b border-gray-50 last:border-b-0"
        >
          <div className="h-12 w-12 rounded-xl bg-gray-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 bg-gray-200 rounded" />
            <div className="h-2 w-1/3 bg-gray-100 rounded" />
          </div>
          <div className="hidden md:flex gap-6">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-3 w-12 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Empty / Error states ──────────────────────────────────────────────────
function EmptyState({ title, subtitle, onRefresh, refreshing, hasFilteredOut }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16 bg-white rounded-2xl border border-gray-100">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-400 mb-4">
        <Layers className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-sm">{subtitle}</p>
      {!hasFilteredOut && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      )}
    </div>
  )
}

function ErrorState({ message, onRetry, retrying }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-red-50/80 border border-red-100 rounded-2xl text-red-700">
      <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Failed to load Instagram posts</p>
        <p className="text-xs mt-0.5 text-red-600/80 break-words">{message}</p>
      </div>
      <button
        onClick={onRetry}
        disabled={retrying}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
      >
        <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
        Retry
      </button>
    </div>
  )
}

// ── Metric Pill (used in table cells) ─────────────────────────────────────
function Metric({ icon: Icon, value, color = 'text-gray-700' }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${color}`}>
      <Icon className="h-3 w-3 text-gray-400" />
      {value}
    </span>
  )
}

// ── Sort Header ───────────────────────────────────────────────────────────
function SortHeader({ label, active, dir, onClick, align = 'right' }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition ${
        active ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'
      } ${align === 'right' ? 'justify-end' : 'justify-start'}`}
    >
      {label}
      {active ? (
        dir === 'asc' ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  )
}

// ── Row (desktop table) ───────────────────────────────────────────────────
function PostRow({ post, rank }) {
  const publishedAt = post.publishedAt ? new Date(post.publishedAt) : null
  const dateLabel = publishedAt
    ? publishedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : post.timeAgo || '—'

  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rank * 0.03, 0.3) }}
      className="hover:bg-purple-50/30 transition-colors"
    >
      {/* Rank */}
      <td className="px-4 py-3 text-sm font-bold text-gray-300">{rank}</td>

      {/* Post info */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={post.thumbnail || `https://ui-avatars.com/api/?name=P&background=E1306C&color=fff&size=80`}
            alt=""
            className="h-11 w-11 rounded-xl object-cover ring-1 ring-gray-100 shrink-0"
            loading="lazy"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-gray-800 line-clamp-1 leading-tight">
              {post.caption || 'No caption'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center rounded-full bg-purple-50 text-purple-600 px-2 py-[2px] text-[10px] font-bold tracking-wide">
                {post.type || 'Post'}
              </span>
              <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {dateLabel}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Reach */}
      <td className="px-3 py-3 text-right text-[13px] font-semibold text-gray-800 tabular-nums">
        {fmt(post.reach || 0)}
      </td>

      {/* Impressions (estimated) */}
      <td className="px-3 py-3 text-right">
        <span className="text-[13px] font-semibold text-gray-800 tabular-nums">
          {fmt(estimateImpressions(post.reach))}
        </span>
        <span className="block text-[9px] text-amber-600 font-medium">est.</span>
      </td>

      {/* Likes */}
      <td className="px-3 py-3 text-right">
        <Metric icon={Heart} value={fmt(post.likes || 0)} color="text-gray-800" />
      </td>

      {/* Comments */}
      <td className="px-3 py-3 text-right">
        <Metric icon={MessageSquare} value={fmt(post.comments || 0)} color="text-gray-800" />
      </td>

      {/* Saves */}
      <td className="px-3 py-3 text-right">
        <Metric icon={Bookmark} value={fmt(post.saves || 0)} color="text-gray-800" />
      </td>

      {/* Shares */}
      <td className="px-3 py-3 text-right">
        <Metric icon={Share2} value={fmt(post.shares || 0)} color="text-gray-800" />
      </td>

      {/* Engagement */}
      <td className="px-3 py-3 text-right">
        <span
          className={`text-[13px] font-bold tabular-nums ${
            (post.engagementRate || 0) >= 5
              ? 'text-emerald-600'
              : (post.engagementRate || 0) >= 3
              ? 'text-purple-600'
              : 'text-gray-600'
          }`}
        >
          {(post.engagementRate || 0).toFixed(1)}%
        </span>
      </td>
    </motion.tr>
  )
}

// ── Card (mobile) ─────────────────────────────────────────────────────────
function PostCard({ post }) {
  const publishedAt = post.publishedAt ? new Date(post.publishedAt) : null
  const dateLabel = publishedAt
    ? publishedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : post.timeAgo || '—'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <img
          src={post.thumbnail || `https://ui-avatars.com/api/?name=P&background=E1306C&color=fff&size=80`}
          alt=""
          className="h-12 w-12 rounded-xl object-cover ring-1 ring-gray-100 shrink-0"
          loading="lazy"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold text-gray-800 line-clamp-2 leading-tight">
              {post.caption || 'No caption'}
            </p>
            <span className="inline-flex items-center shrink-0 rounded-full bg-purple-50 text-purple-600 px-2 py-[2px] text-[10px] font-bold tracking-wide">
              {post.type || 'Post'}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {dateLabel}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 pt-3 border-t border-gray-50">
        <div>
          <p className="text-[9px] uppercase font-semibold text-gray-400 tracking-wider">Reach</p>
          <p className="text-xs font-bold text-gray-800">{fmt(post.reach || 0)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase font-semibold text-gray-400 tracking-wider">Likes</p>
          <p className="text-xs font-bold text-gray-800">{fmt(post.likes || 0)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase font-semibold text-gray-400 tracking-wider">Comments</p>
          <p className="text-xs font-bold text-gray-800">{fmt(post.comments || 0)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase font-semibold text-gray-400 tracking-wider">Eng.</p>
          <p className="text-xs font-bold text-purple-600">{(post.engagementRate || 0).toFixed(1)}%</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <Bookmark className="h-2.5 w-2.5" /> {fmt(post.saves || 0)} saves
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <Share2 className="h-2.5 w-2.5" /> {fmt(post.shares || 0)} shares
        </div>
        <div className="flex items-center gap-1 text-[10px] text-amber-600">
          <Eye className="h-2.5 w-2.5" /> {fmt(estimateImpressions(post.reach))} est. impr.
        </div>
      </div>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function PostsList() {
  const { activeAccountId, selectedAccount, loading: adapterLoading } = useInstagramAdapter()

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('All')
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  const searchRef = useRef(null)

  // Filter demo placeholder — never render it as a real account
  const isRealAccount =
    !!activeAccountId &&
    activeAccountId !== 'demo' &&
    activeAccountId !== 'demo_ig' &&
    activeAccountId !== 'demo_tt' &&
    activeAccountId !== 'demo_li'

  // Fetch posts whenever active account changes
  const fetchPosts = useCallback(
    async (silent = false) => {
      if (!isRealAccount) {
        setPosts([])
        setLoading(false)
        setError('')
        return
      }
      if (!silent) setLoading(true)
      setError('')
      try {
        const res = await getInstagramPosts(activeAccountId)
        const data = res?.data || []
        // Sort defensively by date desc in case backend order varies
        data.sort((a, b) => {
          const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
          const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
          return tb - ta
        })
        setPosts(data)
      } catch (err) {
        const msg =
          err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          'Failed to load Instagram posts'
        setError(msg)
        setPosts([])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [activeAccountId, isRealAccount]
  )

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // Cmd+K focuses search
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

  const handleRefresh = () => {
    setRefreshing(true)
    fetchPosts(true)
  }

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir(key === 'date' || key === 'engagement' ? 'desc' : 'desc')
    }
  }

  // Apply search + tab filter + sort
  const visible = useMemo(() => {
    let list = posts.slice()

    // Tab filter
    if (tab !== 'All') {
      list = list.filter((p) => (p.type || 'Post') === tab)
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) => (p.caption || '').toLowerCase().includes(q))
    }

    // Sort
    list.sort((a, b) => {
      let av = 0
      let bv = 0
      if (sortBy === 'date') {
        av = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
        bv = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
      } else if (sortBy === 'reach') {
        av = a.reach || 0
        bv = b.reach || 0
      } else if (sortBy === 'likes') {
        av = a.likes || 0
        bv = b.likes || 0
      } else if (sortBy === 'comments') {
        av = a.comments || 0
        bv = b.comments || 0
      } else if (sortBy === 'engagement') {
        av = a.engagementRate || 0
        bv = b.engagementRate || 0
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })

    return list
  }, [posts, tab, search, sortBy, sortDir])

  // Per-tab counts
  const tabCounts = useMemo(() => {
    const counts = { All: posts.length, Reel: 0, Carousel: 0, Story: 0 }
    posts.forEach((p) => {
      const t = p.type || 'Post'
      if (counts[t] !== undefined) counts[t] += 1
    })
    return counts
  }, [posts])

  const showSkeleton = (adapterLoading || loading) && !refreshing
  const showEmpty = !loading && !error && visible.length === 0
  const isFilteredEmpty = posts.length > 0 && visible.length === 0

  return (
    <div className="min-h-screen space-y-6">
      <AccountCarousel />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Analyze performance across Reels, Carousels, and Stories.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search captions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-56 rounded-xl border border-gray-200 bg-white pl-9 pr-12 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              ⌘ K
            </kbd>
          </div>

          <button
            onClick={handleRefresh}
            disabled={!isRealAccount || refreshing}
            className="flex items-center gap-1.5 h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-purple-500' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          const count = tabCounts[t.id] ?? 0
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                active
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              <span
                className={`ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                  active ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Body */}
      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <ErrorState message={error} onRetry={handleRefresh} retrying={refreshing} />
          </motion.div>
        ) : showSkeleton ? (
          <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TableSkeleton />
          </motion.div>
        ) : showEmpty ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              title={
                isFilteredEmpty
                  ? `No ${tab === 'All' ? 'posts' : `${tab}s`} match`
                  : 'No posts yet for this account'
              }
              subtitle={
                isFilteredEmpty
                  ? search.trim()
                    ? `No posts match "${search.trim()}"${tab !== 'All' ? ` in ${tab}s` : ''}.`
                    : `This account has no ${tab}s. Try another tab.`
                  : 'Pull fresh data from Instagram to populate this view.'
              }
              onRefresh={handleRefresh}
              refreshing={refreshing}
              hasFilteredOut={isFilteredEmpty}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`posts-${activeAccountId}-${tab}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            {/* Desktop table */}
            <div className="hidden lg:block rounded-2xl border border-gray-100 bg-white overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-12">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Post
                    </th>
                    <th className="px-3 py-3 text-right">
                      <SortHeader
                        label="Reach"
                        active={sortBy === 'reach'}
                        dir={sortDir}
                        onClick={() => handleSort('reach')}
                      />
                    </th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      <span title="Estimated from reach (provider does not expose impressions)">
                        Impr. (est.)
                      </span>
                    </th>
                    <th className="px-3 py-3 text-right">
                      <SortHeader
                        label="Likes"
                        active={sortBy === 'likes'}
                        dir={sortDir}
                        onClick={() => handleSort('likes')}
                      />
                    </th>
                    <th className="px-3 py-3 text-right">
                      <SortHeader
                        label="Comments"
                        active={sortBy === 'comments'}
                        dir={sortDir}
                        onClick={() => handleSort('comments')}
                      />
                    </th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Saves
                    </th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Shares
                    </th>
                    <th className="px-3 py-3 text-right">
                      <SortHeader
                        label="Engagement"
                        active={sortBy === 'engagement'}
                        dir={sortDir}
                        onClick={() => handleSort('engagement')}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visible.map((post, i) => (
                    <PostRow key={post.id || `post-${i}`} post={post} rank={i + 1} />
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-500 flex items-center justify-between">
                <span>
                  Showing <span className="font-bold text-gray-700">{visible.length}</span> of{' '}
                  <span className="font-bold text-gray-700">{posts.length}</span> posts
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <TrendingUp className="h-3 w-3" />
                  {tab === 'All' ? 'All types' : `Filtered to ${tab}s`}
                </span>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden space-y-3">
              {visible.map((post, i) => (
                <PostCard key={post.id || `post-m-${i}`} post={post} />
              ))}
              <p className="text-center text-xs text-gray-400 pt-2">
                Showing {visible.length} of {posts.length} posts
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
