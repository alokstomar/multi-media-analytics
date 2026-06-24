import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, Plus, LayoutGrid, List } from 'lucide-react'
import { getChannels, getAnalytics, getInsights } from '../services/api'
import { useAnalytics } from '../context/AnalyticsContext'
import { StatsSkeleton, BannerSkeleton, CardSkeleton } from '../components/channels/ChannelPageSkeleton'
import ChannelStatsRow from '../components/channels/ChannelStatsRow'
import FeaturedBanner from '../components/channels/FeaturedBanner'
import ChannelCard from '../components/channels/ChannelCard'
import ChannelSidebar from '../components/channels/ChannelSidebar'
import EmptyState from '../components/channels/EmptyState'
import { ErrorBanner } from '../components/ui/Skeleton'

export default function Channels() {
  const [channels, setChannels] = useState([])
  const [analyticsMap, setAnalyticsMap] = useState({})
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [filter, setFilter] = useState('all')

  const {
    addChannel: contextAddChannel,
    removeChannel: contextRemoveChannel,
    updateChannel: contextUpdateChannel,
  } = useAnalytics()

  // Add channel dialog state
  const [showAdd, setShowAdd] = useState(false)
  const [addInput, setAddInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getChannels()
      const chs = res.data || []
      setChannels(chs)

      // Load analytics for each channel in parallel
      const anaResults = await Promise.allSettled(
        chs.map((ch) => getAnalytics(ch.channelId))
      )
      const map = {}
      anaResults.forEach((r, i) => {
        if (r.status === 'fulfilled') map[chs[i].channelId] = r.value.data?.overview || {}
      })
      setAnalyticsMap(map)

      // Load insights for top channel
      if (chs.length) {
        getInsights(chs[0].channelId)
          .then((r) => setInsights(r.data || []))
          .catch(() => {})
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load channels')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function handleAdd() {
    if (!addInput.trim()) return
    setAdding(true)
    setAddError('')
    try {
      await contextAddChannel(addInput.trim())
      setAddInput('')
      setShowAdd(false)
      await loadAll()
    } catch (err) {
      const apiMsg = err.response?.data?.message || err.response?.data?.error
      if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
        setAddError('Channel lookup timed out — the backend cold-started or YouTube is slow. Please retry in a few seconds.')
      } else if (err.response?.status === 401) {
        setAddError('Your session has expired. Please log in again.')
      } else if (err.response?.status === 403) {
        setAddError('Workspace context missing or access denied. Refresh the page and try again.')
      } else if (!err.response) {
        setAddError(`Network error — unable to reach the backend. Check your connection and retry. (${err.message || 'no response'})`)
      } else {
        setAddError(apiMsg || 'Failed to add channel')
      }
    } finally {
      setAdding(false)
    }
  }

  async function handleRefresh(channelId) {
    try {
      await contextUpdateChannel(channelId)
      await loadAll()
    } catch {}
  }

  async function handleRemove(channelId) {
    if (!confirm('Remove this channel?')) return
    try {
      await contextRemoveChannel(channelId)
      await loadAll()
    } catch {}
  }

  // Featured = channel with most subscribers
  const featured = channels.length
    ? [...channels].sort((a, b) => b.subscribers - a.subscribers)[0]
    : null

  // Filter/search
  const filtered = channels.filter((ch) => {
    const q = search.toLowerCase()
    const matchSearch = ch.title?.toLowerCase().includes(q) ||
      ch.handle?.toLowerCase().includes(q) ||
      ch.channelId?.toLowerCase().includes(q)
    const ana = analyticsMap[ch.channelId] || {}
    if (filter === 'growing') return matchSearch && (ana.viewsGrowth || 0) > 0
    if (filter === 'declining') return matchSearch && (ana.viewsGrowth || 0) < 0
    if (filter === 'high-engagement') return matchSearch && (ana.engagementRate || 0) > 3
    return matchSearch
  })

  return (
    <div className="min-h-screen">
      {/* ── Page Header ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Channels</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and monitor all connected YouTube channels
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search channels..."
              className="w-56 rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 bg-white pl-10 pr-8 py-2.5 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition cursor-pointer"
            >
              <option value="all">All Channels</option>
              <option value="growing">Growing</option>
              <option value="declining">Declining</option>
              <option value="high-engagement">High Engagement</option>
            </select>
          </div>

          <div className="flex items-center rounded-xl border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 transition ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 transition ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-500/20"
          >
            <Plus className="h-4 w-4" />
            Add Channel
          </button>
        </div>
      </motion.div>

      {/* ── Add Channel Modal ──────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-1">Add YouTube Channel</h3>
            <p className="text-sm text-gray-500 mb-4">Paste a channel URL, @handle, or channel ID</p>
            <input
              type="text"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. @MrBeast or channel URL"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition mb-3"
              autoFocus
              disabled={adding}
            />
            {addError && <p className="text-xs text-red-500 mb-3">{addError}</p>}
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => { setShowAdd(false); setAddInput(''); setAddError('') }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={adding}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {adding ? 'Analyzing...' : 'Add Channel'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────── */}
      {error && !loading && <ErrorBanner message={error} onRetry={loadAll} />}

      {/* ── Stats Row ───────────────────────────────────── */}
      <div className="mb-6">
        {loading ? <StatsSkeleton /> : <ChannelStatsRow channels={channels} />}
      </div>

      {/* ── Featured Banner ─────────────────────────────── */}
      {!loading && featured && (
        <div className="mb-8">
          <FeaturedBanner channel={featured} onRefresh={handleRefresh} />
        </div>
      )}
      {loading && <div className="mb-8"><BannerSkeleton /></div>}

      {/* ── Main Content ────────────────────────────────── */}
      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          {!loading && channels.length === 0 ? (
            <EmptyState />
          ) : (
            <div className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5'
                : 'space-y-4'
            }>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
                : filtered.map((ch, i) => (
                    <ChannelCard
                      key={ch.channelId}
                      channel={ch}
                      index={i}
                      analytics={analyticsMap[ch.channelId]}
                      onRefresh={handleRefresh}
                      onRemove={handleRemove}
                    />
                  ))
              }
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <p className="text-center text-xs text-gray-400 mt-8">
              Showing {filtered.length} of {channels.length} channels
            </p>
          )}
        </div>

        {/* Sidebar */}
        <div className="hidden xl:block w-72 shrink-0">
          <ChannelSidebar channels={channels} insights={insights} />
        </div>
      </div>
    </div>
  )
}
