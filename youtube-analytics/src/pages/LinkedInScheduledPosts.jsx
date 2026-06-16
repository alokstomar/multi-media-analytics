import { useState } from 'react'
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

const MOCK_SCHEDULED = [
  {
    id: 'ln-sc1',
    title: 'The compounding social leverage of B2B checklists',
    content: 'Building a leveraged social engine is not about automated spam. It is about syndicating data blueprints into visual checklists. 📊👇',
    type: 'thought-leadership',
    date: '2026-06-02',
    time: '10:00 AM',
    account: 'Samay Raina',
    status: 'Scheduled'
  },
  {
    id: 'ln-sc2',
    title: 'Production release Phase 3 AI case study',
    content: 'Our engineering team just pushed Phase 3 AI capabilities live to production! Here is the full case study on how we reduced Vite Rollups to 1.9s:',
    type: 'industry-insight',
    date: '2026-06-03',
    time: '02:00 PM',
    account: 'Samay Gaming Co',
    status: 'Scheduled'
  },
  {
    id: 'ln-sc3',
    title: '5 structures to write high-converting carousels',
    content: '5 frameworks to structure high-converting LinkedIn carousel hooks in 2026. 🧵👇',
    type: 'personal',
    date: '2026-06-04',
    time: '09:00 AM',
    account: 'Samay Raina',
    status: 'Pending Queue'
  },
  {
    id: 'ln-sc4',
    title: 'Why traditional B2B marketing is completely broken',
    content: 'Why traditional B2B SaaS marketing is completely broken. (The compounding playbooks we are using instead):',
    type: 'story',
    date: '2026-06-05',
    time: '11:30 AM',
    account: 'Samay Raina',
    status: 'Scheduled'
  }
]

export default function LinkedInScheduledPosts() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState(MOCK_SCHEDULED)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [accountFilter, setAccountFilter] = useState('All')
  const [successToast, setSuccessToast] = useState('')

  const [rescheduleItem, setRescheduleItem] = useState(null)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')

  const showToast = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(''), 3000)
  }

  // Cancel scheduled post
  const handleCancel = (id) => {
    if (window.confirm('Are you sure you want to cancel this scheduled post?')) {
      setPosts(posts.map(p => p.id === id ? { ...p, status: 'Cancelled' } : p))
      showToast('Scheduled post cancelled successfully!')
    }
  }

  // Duplicate scheduled post
  const handleDuplicate = (post) => {
    const dup = {
      ...post,
      id: 'ln-sc-' + Date.now(),
      title: `${post.title} (Copy)`,
      status: 'Scheduled'
    }
    setPosts([dup, ...posts])
    showToast('Post duplicated successfully!')
  }

  // Reschedule trigger
  const triggerRescheduleModal = (post) => {
    setRescheduleItem(post)
    setNewDate(post.date)
    setNewTime(post.time.includes('AM') || post.time.includes('PM') ? '12:00' : post.time)
  }

  // Submit Reschedule
  const submitReschedule = (e) => {
    e.preventDefault()
    if (!rescheduleItem || !newDate || !newTime) return

    // Convert time to AM/PM format for consistency
    const [hrs, mins] = newTime.split(':')
    const h = parseInt(hrs)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const dispHrs = h % 12 === 0 ? 12 : h % 12
    const formattedTime = `${dispHrs}:${mins} ${ampm}`

    setPosts(posts.map(p => p.id === rescheduleItem.id ? { ...p, date: newDate, time: formattedTime, status: 'Scheduled' } : p))
    showToast('Rescheduled post successfully!')
    setRescheduleItem(null)
  }

  // Filters application
  const filteredPosts = posts.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'All' ? true : p.status === statusFilter
    const matchesType = typeFilter === 'All' ? true : p.type === typeFilter
    const matchesAccount = accountFilter === 'All' ? true : p.account === accountFilter
    return matchesSearch && matchesStatus && matchesType && matchesAccount
  })

  // Computations
  const scheduledToday = posts.filter(p => p.status === 'Scheduled').length
  const pendingPosts = posts.filter(p => p.status === 'Pending Queue').length
  const activeAccounts = 2

  return (
    <div className="min-h-screen bg-gray-50/50 space-y-8 pb-12">
      {/* Toast */}
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
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0077b5] text-white">
              <LinkedInIcon className="h-4.5 w-4.5" />
            </span>
            Scheduled Posts
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Formulate thought leadership distributions, manage upcoming dispatches, and optimize scheduled professional articles.
          </p>
        </div>

        <button
          onClick={() => navigate('/linkedin/new-post')}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition shadow-sm shadow-blue-500/10 self-start sm:self-center"
        >
          <Plus className="w-3.5 h-3.5" />
          Schedule New Post
        </button>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scheduled Today</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{scheduledToday}</p>
              <p className="mt-1 text-xs font-medium text-blue-600">Pending dispatches</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-inner">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scheduled This Week</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{posts.length}</p>
              <p className="mt-1 text-xs font-medium text-emerald-600">Compounding outreach</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-inner">
              <CalendarIcon className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending Posts</p>
              <p className="mt-1.5 text-2xl font-bold text-purple-600">{pendingPosts}</p>
              <p className="mt-1 text-xs font-medium text-purple-600">Queue buffer size</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shadow-inner">
              <CalendarRange className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Accounts</p>
              <p className="mt-1.5 text-2xl font-bold text-gray-900">{activeAccounts}</p>
              <p className="mt-1 text-xs font-medium text-blue-600">Professional channels</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-inner">
              <LinkedInIcon className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main filter toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search */}
        <div className="flex items-center gap-2.5 max-w-sm w-full border border-gray-100 bg-gray-50/50 px-3.5 py-2 rounded-xl focus-within:border-blue-400 focus-within:bg-white transition">
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search upcoming titles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-0 outline-none text-xs text-gray-700 font-semibold"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-100 text-xs font-bold text-gray-600 bg-white outline-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Pending Queue">Pending Queue</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Type</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-100 text-xs font-bold text-gray-600 bg-white outline-none cursor-pointer"
            >
              <option value="All">All Types</option>
              <option value="thought-leadership">Thought Leadership</option>
              <option value="industry-insight">Industry Insight</option>
              <option value="personal">Personal</option>
              <option value="story">Story</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Profile</span>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-100 text-xs font-bold text-gray-600 bg-white outline-none cursor-pointer"
            >
              <option value="All">All Profiles</option>
              <option value="Samay Raina">Samay Raina</option>
              <option value="Samay Gaming Co">Samay Gaming Co</option>
            </select>
          </div>
        </div>
      </div>

      {/* Datatable */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm overflow-hidden">
        {filteredPosts.length === 0 ? (
          <div className="py-16 text-center text-gray-400 space-y-2">
            <CalendarIcon className="w-8 h-8 text-gray-300 mx-auto animate-pulse" />
            <p className="text-xs font-bold text-gray-700">No upcoming LinkedIn posts match the filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="pb-3.5 pl-2">Post Title</th>
                  <th className="pb-3.5">Account</th>
                  <th className="pb-3.5">Content Type</th>
                  <th className="pb-3.5">Scheduled Date</th>
                  <th className="pb-3.5">Scheduled Time</th>
                  <th className="pb-3.5">Status</th>
                  <th className="pb-3.5 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs font-semibold text-gray-700">
                {filteredPosts.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/20 transition">
                    <td className="py-4 pl-2 font-bold text-gray-900 truncate max-w-[200px]" title={p.content}>
                      {p.title}
                    </td>
                    <td className="py-4 text-gray-600 font-semibold">{p.account}</td>
                    <td className="py-4">
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded capitalize">
                        {p.type.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="py-4 text-gray-500 font-semibold">{p.date}</td>
                    <td className="py-4 text-gray-500 font-semibold">{p.time}</td>
                    <td className="py-4">
                      <span className={`inline-block text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        p.status === 'Scheduled' ? 'bg-emerald-50 text-emerald-600' :
                        p.status === 'Pending Queue' ? 'bg-purple-50 text-purple-600' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-4 pr-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => triggerRescheduleModal(p)}
                          className="flex h-7 px-2 items-center gap-1 border border-gray-100 hover:bg-gray-50 text-gray-600 rounded-lg text-[9px] font-bold cursor-pointer transition"
                        >
                          Reschedule
                        </button>
                        <button
                          onClick={() => handleDuplicate(p)}
                          title="Duplicate clone"
                          className="flex h-7 w-7 items-center justify-center hover:bg-gray-50 text-gray-400 border border-gray-100 rounded-lg cursor-pointer transition"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {p.status !== 'Cancelled' && (
                          <button
                            onClick={() => handleCancel(p.id)}
                            title="Cancel scheduled"
                            className="flex h-7 w-7 items-center justify-center hover:bg-red-50 text-red-500 border border-transparent hover:border-red-100 rounded-lg cursor-pointer transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reschedule DateTime Picker Modal */}
      <AnimatePresence>
        {rescheduleItem && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.form
              onSubmit={submitReschedule}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[24px] shadow-2xl border border-gray-100 p-6 w-full max-w-md space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-blue-600" />
                  Reschedule LinkedIn Post
                </h3>
                <button
                  type="button"
                  onClick={() => setRescheduleItem(null)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold cursor-pointer"
                >
                  ✕
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
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-800 bg-gray-50/50 outline-none focus:border-blue-400 transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block pl-1">New Time</label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-100 text-xs font-semibold text-gray-800 bg-gray-50/50 outline-none focus:border-blue-400 transition"
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
                  Confirm Changes
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
