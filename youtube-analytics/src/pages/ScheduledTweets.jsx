import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Calendar as CalendarIcon,
  Search,
  SlidersHorizontal,
  Edit2,
  CalendarRange,
  Copy,
  XCircle,
  CheckCircle,
  Plus
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  getTwitterScheduled,
  createTwitterScheduled,
  updateTwitterScheduled,
  cancelTwitterScheduled,
  deleteTwitterScheduled
} from '../services/api'

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

export default function ScheduledTweets() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState('')
  const [successToast, setSuccessToast] = useState('')

  const [rescheduleItem, setRescheduleItem] = useState(null)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  const loadScheduled = async () => {
    setLoading(true)
    try {
      const res = await getTwitterScheduled()
      if (res?.success) {
        setPosts(res.data || [])
      }
    } catch (err) {
      console.error('Failed to load scheduled tweets:', err)
      showToast('Error loading scheduled queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadScheduled()
  }, [])

  // Cancel scheduled post
  const handleCancel = async (id) => {
    if (window.confirm('Are you sure you want to cancel this scheduled post? It will be marked as cancelled.')) {
      try {
        const res = await cancelTwitterScheduled(id)
        if (res?.success) {
          showToast('Scheduled post cancelled successfully!')
          await loadScheduled()
        }
      } catch (err) {
        showToast(`Error: ${err.message}`)
      }
    }
  }

  // Duplicate scheduled post
  const handleDuplicate = async (post) => {
    try {
      const scheduledTime = new Date(Date.now() + 86400000 * 2) // 2 days later
      const payload = {
        content: `${post.content} (Copy)`,
        type: post.type || 'tweet',
        threadPosts: post.threadPosts || [],
        scheduledAt: scheduledTime.toISOString(),
        account: post.account || '@samay_raina',
        status: 'pending'
      }
      const res = await createTwitterScheduled(payload)
      if (res?.success) {
        showToast('Scheduled post duplicated successfully!')
        await loadScheduled()
      }
    } catch (err) {
      showToast(`Error: ${err.message}`)
    }
  }

  // Edit action
  const handleEdit = (post) => {
    if (post.type === 'thread' || post.type === 'Thread') {
      navigate('/threads', { state: { content: post.content } })
    } else {
      navigate('/new-tweet', { state: { content: post.content } })
    }
  }

  // Reschedule save
  const handleRescheduleSubmit = async (e) => {
    e.preventDefault()
    if (!newDate || !newTime || !rescheduleItem) return
    try {
      const scheduledAt = new Date(`${newDate}T${newTime}`).toISOString()
      const res = await updateTwitterScheduled(rescheduleItem._id, { scheduledAt, status: 'pending' })
      if (res?.success) {
        showToast('Post rescheduled successfully!')
        setRescheduleItem(null)
        await loadScheduled()
      }
    } catch (err) {
      showToast(`Error: ${err.message}`)
    }
  }

  // Open reschedule modal
  const openRescheduleModal = (post) => {
    setRescheduleItem(post)
    const dt = new Date(post.scheduledAt)
    setNewDate(dt.toISOString().split('T')[0])
    setNewTime(dt.toTimeString().substring(0, 5))
  }

  // Filter application
  const filteredPosts = posts.filter(p => {
    const matchesSearch = p.content.toLowerCase().includes(searchQuery.toLowerCase())
    
    // Status translation mapping
    let translatedStatus = p.status
    if (p.status === 'pending') translatedStatus = 'Scheduled'
    else if (p.status === 'cancelled') translatedStatus = 'Cancelled'
    
    const matchesStatus = statusFilter === 'All' || translatedStatus === statusFilter
    
    const pDate = new Date(p.scheduledAt).toISOString().split('T')[0]
    const matchesDate = !dateFilter || pDate === dateFilter
    
    return matchesSearch && matchesStatus && matchesDate
  })

  // Computations for KPI cards
  const todayStr = new Date().toISOString().split('T')[0]
  const scheduledToday = posts.filter(p => {
    const pDate = new Date(p.scheduledAt).toISOString().split('T')[0]
    return pDate === todayStr && p.status === 'pending'
  }).length
  const scheduledThisWeek = posts.filter(p => p.status === 'pending').length
  const threadsScheduled = posts.filter(p => p.type === 'thread' && p.status === 'pending').length
  const cancelledCount = posts.filter(p => p.status === 'cancelled').length

  return (
    <div className="min-h-screen bg-gray-50/50 space-y-8 pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg text-xs font-bold"
          >
            <CheckCircle className="w-4 h-4" />
            {successToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white">
              <TwitterIcon className="h-4 w-4" fill="currentColor" />
            </span>
            Scheduled Queue Manager
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor, edit, reschedule, or cancel future tweets and threads before they hit the X algorithm.
          </p>
        </div>

        <button
          onClick={() => navigate('/new-tweet')}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition shadow-sm shadow-blue-500/10 self-start sm:self-center"
        >
          <Plus className="w-3.5 h-3.5" />
          Schedule New Post
        </button>
      </div>

      {/* KPI stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scheduled Today</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{scheduledToday}</p>
              <p className="mt-1 text-xs font-medium text-blue-600">On-track for publishing</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-inner">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Scheduled</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{scheduledThisWeek}</p>
              <p className="mt-1 text-xs font-medium text-indigo-600">Active queue size</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-inner">
              <CalendarIcon className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Threads Pending</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{threadsScheduled}</p>
              <p className="mt-1 text-xs font-medium text-violet-600">Multi-post workflows</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 shadow-inner">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cancelled Items</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{cancelledCount}</p>
              <p className="mt-1 text-xs font-medium text-gray-500">Removed from pipeline</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600 shadow-inner">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Datatable Workspace */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
        {/* Advanced Filters Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search */}
            <div className="flex items-center gap-2 max-w-xs w-full border border-gray-100 bg-gray-50/50 px-3.5 py-1.5 rounded-xl focus-within:border-blue-400 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-400/20 transition">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search upcoming content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-0 outline-0 text-xs text-gray-700 placeholder-gray-400 font-medium"
              />
            </div>

            {/* Date filter */}
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-gray-100 bg-gray-50/50 text-[11px] font-bold text-gray-600 outline-none focus:border-blue-400 transition"
            />

            {/* Status select filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-1.5 rounded-xl border border-gray-100 bg-gray-50/50 text-[11px] font-bold text-gray-600 outline-none focus:border-blue-400 transition cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {(searchQuery || dateFilter || statusFilter !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setDateFilter('')
                setStatusFilter('All')
              }}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Datatable */}
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <Clock className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">No scheduled posts matched</p>
              <p className="text-xs text-gray-400">Change your search queries or filter selections above.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="pb-3.5 pl-2">Content Preview</th>
                  <th className="pb-3.5">Type</th>
                  <th className="pb-3.5">Date</th>
                  <th className="pb-3.5">Time</th>
                  <th className="pb-3.5">Account</th>
                  <th className="pb-3.5">Status</th>
                  <th className="pb-3.5 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs font-medium text-gray-700">
                {filteredPosts.map((post) => (
                  <tr key={post._id} className="hover:bg-gray-50/30 transition">
                    <td className="py-4 pl-2 text-gray-900 max-w-[280px] lg:max-w-[400px] truncate">
                      {post.content}
                    </td>
                    <td className="py-4">
                      <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        post.type === 'thread' || post.type === 'Thread' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {post.type}
                      </span>
                    </td>
                    <td className="py-4 font-semibold text-gray-800">
                      {new Date(post.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-4 text-gray-500">
                      {new Date(post.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-4 font-bold text-gray-500">{post.account || '@samay_raina'}</td>
                    <td className="py-4">
                      <span className={`inline-block text-[9px] font-bold px-2.5 py-0.5 rounded-full ${
                        post.status === 'pending'
                          ? 'bg-blue-50 text-blue-600'
                          : post.status === 'cancelled'
                          ? 'bg-gray-100 text-gray-500'
                          : 'bg-red-50 text-red-500'
                      }`}>
                        {post.status === 'pending' ? 'Scheduled' : post.status}
                      </span>
                    </td>
                    <td className="py-4 pr-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleEdit(post)}
                          title="Edit composer text"
                          className="flex h-7 w-7 items-center justify-center hover:bg-gray-50 text-gray-500 hover:text-gray-900 border border-gray-100 rounded-lg cursor-pointer transition"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => openRescheduleModal(post)}
                          title="Reschedule calendar date/time"
                          className="flex h-7 w-7 items-center justify-center hover:bg-gray-50 text-gray-500 hover:text-gray-900 border border-gray-100 rounded-lg cursor-pointer transition"
                        >
                          <CalendarRange className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(post)}
                          title="Duplicate scheduled item"
                          className="flex h-7 w-7 items-center justify-center hover:bg-gray-50 text-gray-500 hover:text-gray-900 border border-gray-100 rounded-lg cursor-pointer transition"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleCancel(post._id)}
                          disabled={post.status === 'cancelled'}
                          title="Cancel schedule permanently"
                          className="flex h-7 w-7 items-center justify-center hover:bg-red-50 text-red-500 rounded-lg cursor-pointer transition disabled:opacity-30"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reschedule Picker Modal Overlay */}
      <AnimatePresence>
        {rescheduleItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          >
            <motion.form
              onSubmit={handleRescheduleSubmit}
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-[24px] border border-gray-100 p-6 w-full max-w-sm shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <CalendarRange className="w-4 h-4 text-blue-600" />
                  Reschedule Publication
                </h3>
                <button
                  type="button"
                  onClick={() => setRescheduleItem(null)}
                  className="p-1 hover:bg-gray-50 rounded-full text-gray-400 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">New Date</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/25 transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">New Time</label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 bg-gray-50/50 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/25 transition"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleItem(null)}
                  className="h-10 px-4 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer shadow-sm shadow-blue-500/10"
                >
                  Confirm Reschedule
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
