import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers,
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  User,
  Activity,
  Award,
  Filter,
  Eye
} from 'lucide-react'
import { getPublishedPosts } from '../services/api'

const TwitterIcon = (props) => (
  <svg
    className={props.className || "h-4 w-4"}
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 4l11.73 16h4.27L8.27 4H4z" />
    <path d="M18 4l-6.25 6.25m-2.5 2.5L4 20" />
  </svg>
)

const LinkedInIcon = (props) => (
  <svg
    className={props.className || "h-4 w-4"}
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
  </svg>
)

const InstagramIcon = (props) => (
  <svg
    className={props.className || "h-4 w-4"}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
)

export default function PublishedContent() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [platformFilter, setPlatformFilter] = useState('All')
  const [selectedPost, setSelectedPost] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  const loadPublishedPosts = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await getPublishedPosts()
      if (res?.success) {
        setPosts(res.data || [])
      } else {
        setPosts([])
      }
    } catch (err) {
      console.error('Failed to load published posts:', err)
      showToast('Error loading published content.')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadPublishedPosts()
  }, [])

  // Filters application
  const filteredPosts = posts.filter(p => {
    const matchesSearch = p.content?.toLowerCase().includes(searchQuery.toLowerCase())
    if (platformFilter === 'All') return matchesSearch
    return p.platform?.toLowerCase() === platformFilter.toLowerCase() && matchesSearch
  })

  // Computations for Metrics
  const totalCount = posts.length
  const totalRetries = posts.reduce((sum, p) => sum + (p.retryCount || 0), 0)
  const avgDuration = posts.length > 0 
    ? Math.round(posts.reduce((sum, p) => sum + (p.executionDurationMs || 0), 0) / posts.length)
    : 0

  const getPlatformUrl = (post) => {
    if (!post.providerPostId) return null
    if (post.providerPostId.startsWith('mock_')) return '#'
    
    if (post.platform === 'twitter') {
      return `https://x.com/i/status/${post.providerPostId}`
    }
    if (post.platform === 'linkedin') {
      return `https://www.linkedin.com/feed/update/${post.providerPostId}`
    }
    if (post.platform === 'instagram') {
      return `https://www.instagram.com/p/${post.providerPostId}`
    }
    return '#'
  }

  return (
    <div className="min-h-screen bg-gray-50/50 space-y-8 pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg text-xs font-bold"
          >
            <CheckCircle className="w-4 h-4" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-100">
              <Layers className="h-4 w-4" />
            </span>
            Published Content History
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            View live dispatches, track performance execution telemetry, and manage cross-channel publishing logs.
          </p>
        </div>

        <button
          onClick={() => loadPublishedPosts()}
          disabled={loading}
          className="flex h-9 w-9 items-center justify-center border border-gray-100 hover:bg-gray-50 text-gray-600 rounded-xl cursor-pointer transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Analytics/Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Dispatched</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{totalCount}</p>
              <p className="mt-1 text-xs font-medium text-indigo-600 flex items-center gap-0.5">
                <CheckCircle className="w-3 h-3 text-indigo-600" /> Active social broadcasts
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-inner">
              <Award className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Avg Execution Time</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{avgDuration}ms</p>
              <p className="mt-1 text-xs font-medium text-emerald-600">Low latency submission</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-inner">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Retries Avoided</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{totalRetries}</p>
              <p className="mt-1 text-xs font-medium text-amber-600">Auto-recovery success</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500 shadow-inner">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Datatable Workspace */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search */}
            <div className="flex items-center gap-2 max-w-xs w-full border border-gray-100 bg-gray-50/50 px-3.5 py-1.5 rounded-xl focus-within:border-blue-400 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-400/20 transition">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search published text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-0 outline-0 text-xs text-gray-700 placeholder-gray-400 font-medium"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex border border-gray-100 rounded-xl p-0.5 bg-gray-50/50">
              {['All', 'Twitter', 'LinkedIn', 'Instagram'].map(p => (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={`px-4 h-7 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                    platformFilter === p ? 'bg-white text-gray-800 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        {filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">No published logs found</p>
              <p className="text-xs text-gray-400">Try adjusting your search filters or check worker health.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="pb-3.5 pl-2">Post Commentary</th>
                  <th className="pb-3.5">Platform</th>
                  <th className="pb-3.5">Content Type</th>
                  <th className="pb-3.5">Published At</th>
                  <th className="pb-3.5 text-center">Execution (ms)</th>
                  <th className="pb-3.5 text-center">Retries</th>
                  <th className="pb-3.5">Publisher</th>
                  <th className="pb-3.5 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs font-medium text-gray-700">
                {filteredPosts.map((post) => {
                  const platformUrl = getPlatformUrl(post)
                  const isMockLink = platformUrl === '#' || post.providerPostId?.startsWith('mock_')
                  
                  return (
                    <tr key={post._id} className="hover:bg-gray-50/30 transition">
                      <td className="py-4 pl-2 text-gray-900 max-w-[240px] lg:max-w-[360px] truncate">
                        <div className="font-semibold truncate" title={post.content}>
                          {post.content}
                        </div>
                        {post.providerPostId && (
                          <div className="text-[9px] text-gray-400 mt-0.5 truncate select-all">
                            ID: {post.providerPostId}
                          </div>
                        )}
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex items-center gap-1 font-bold ${
                          post.platform === 'twitter' 
                            ? 'text-gray-900' 
                            : post.platform === 'instagram' 
                              ? 'text-[#e1306c]' 
                              : 'text-[#0077b5]'
                        }`}>
                          {post.platform === 'twitter' ? (
                            <TwitterIcon className="w-3 h-3" />
                          ) : post.platform === 'instagram' ? (
                            <InstagramIcon className="w-3 h-3" />
                          ) : (
                            <LinkedInIcon className="w-3 h-3" />
                          )}
                          <span className="capitalize">{post.platform}</span>
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          post.platform === 'instagram' 
                            ? 'bg-pink-50 text-pink-700 border border-pink-100'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {post.responsePayload?.contentType || post.contentType || (post.platform === 'instagram' ? 'image' : 'text')}
                        </span>
                      </td>
                      <td className="py-4 font-semibold text-gray-500">
                        {new Date(post.publishedAt).toLocaleString()}
                      </td>
                      <td className="py-4 text-center font-bold text-gray-600">
                        {post.executionDurationMs || 0}ms
                      </td>
                      <td className="py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          post.retryCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {post.retryCount || 0}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1.5 text-gray-600 font-semibold">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span className="truncate max-w-[100px]">{post.publishedBy || 'system'}</span>
                        </div>
                      </td>
                      <td className="py-4 pr-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedPost(post)}
                            className="flex h-7 w-7 items-center justify-center hover:bg-gray-50 text-gray-500 border border-transparent hover:border-gray-100 rounded-lg cursor-pointer transition"
                            title="Inspect Payload"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          
                          {platformUrl && (
                            <a
                              href={platformUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => {
                                if (isMockLink) {
                                  e.preventDefault()
                                  showToast('Platform link unavailable in mock mode.')
                                }
                              }}
                              className={`flex h-7 px-2.5 items-center gap-1 rounded-lg text-[10px] font-bold transition border ${
                                isMockLink
                                  ? 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                                  : 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100 text-indigo-600'
                              }`}
                              title={isMockLink ? 'Mock post cannot be viewed live' : 'View post on live platform'}
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspector Modal */}
      <AnimatePresence>
        {selectedPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black"
              onClick={() => setSelectedPost(null)}
            />
            {/* Dialog Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    Publishing Telemetry Inspector
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Job ID: {selectedPost._id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="h-7 w-7 flex items-center justify-center hover:bg-gray-100 text-gray-500 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 text-xs text-gray-700">
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-3.5 bg-gray-50 p-4 rounded-xl font-medium border border-gray-100">
                  <div>
                    <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">Platform</span>
                    <span className="capitalize font-bold text-gray-900 mt-0.5 block">{selectedPost.platform}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">Publisher</span>
                    <span className="font-bold text-gray-900 mt-0.5 block">{selectedPost.publishedBy || 'system'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">Content Type</span>
                    <span className="capitalize font-bold text-gray-900 mt-0.5 block">
                      {selectedPost.responsePayload?.contentType || selectedPost.contentType || (selectedPost.platform === 'instagram' ? 'image' : 'text')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">Duration</span>
                    <span className="font-bold text-indigo-600 mt-0.5 block">{selectedPost.executionDurationMs || 0}ms</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">Retries</span>
                    <span className="font-bold text-amber-600 mt-0.5 block">{selectedPost.retryCount || 0} attempt(s)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-semibold uppercase tracking-wider">Publish Source</span>
                    <span className="font-bold text-gray-900 mt-0.5 block">{selectedPost.publishSource}</span>
                  </div>
                </div>

                {/* Content text */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Full Post Commentary</span>
                  <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl whitespace-pre-wrap leading-relaxed font-semibold font-mono text-gray-800">
                    {selectedPost.content}
                  </div>
                </div>

                {/* Response Payload */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Raw Platform Response Payload</span>
                  <pre className="bg-gray-900 text-emerald-400 p-4 rounded-xl overflow-x-auto text-[10px] font-mono leading-relaxed max-h-56">
                    {JSON.stringify(selectedPost.responsePayload || {}, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3.5 bg-gray-50/50 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setSelectedPost(null)}
                  className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
